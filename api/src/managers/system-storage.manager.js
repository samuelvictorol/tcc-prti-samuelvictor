const path = require('node:path');
const { Transform } = require('node:stream');
const mongoose = require('mongoose');
const archiver = require('archiver');
const ApiError = require('../utils/api-error');
const Log = require('../models/log.model');
const mediaManager = require('./template-media.manager');
const templatesManager = require('./templates.manager');
const backupStorage = require('../services/conversation-backup-storage.service');
const queueService = require('../services/queue.service');
const maintenance = require('../services/storage-maintenance.service');
const { parsePagination, pageResult } = require('../utils/pagination');

const POLICY = Object.freeze({
  adminnotifications: { title: 'Atualizacoes da central', help: 'Avisos exibidos no sino administrativo; limpos somente na operacao geral para evitar concorrencia.', exportable: true, clearable: false, globalClearable: true },
  chatemailchallenges: { title: 'Desafios de e-mail do chat', help: 'Artefatos temporarios vinculados a contatos; nunca sao exportados e sao revogados na limpeza geral.', exportable: false, clearable: false, globalClearable: true },
  consentevents: { title: 'Consentimentos', help: 'Historico legal protegido contra limpeza isolada.', exportable: true, clearable: false, globalClearable: true },
  contactgroups: { title: 'Grupos de contatos', help: 'Possui vinculos; somente a limpeza geral evita referencias quebradas.', exportable: true, clearable: false, globalClearable: true },
  contacts: { title: 'Contatos', help: 'Possui muitos vinculos; somente a limpeza geral e atomica do dominio e permitida.', exportable: true, clearable: false, globalClearable: true },
  conversationbackups: { title: 'Backups de conversas', help: 'Metadados de backups; conteudo criptografado nao e exportado.', exportable: true, clearable: true },
  conversationmessages: { title: 'Mensagens', help: 'Vinculada a conversas; somente a limpeza geral e permitida.', exportable: true, clearable: false, globalClearable: true },
  conversations: { title: 'Conversas', help: 'Vinculada a mensagens; somente a limpeza geral e permitida.', exportable: true, clearable: false, globalClearable: true },
  inviteclicks: { title: 'Cliques de convites', help: 'Atribuicoes anonimizadas dos convites.', exportable: true, clearable: false, globalClearable: true },
  inboundemailalerts: { title: 'Avisos de mensagens recebidas', help: 'Reservas idempotentes dos avisos por email disparados a partir de webhooks; nao contem o texto nem o destinatario.', exportable: true, clearable: true, globalClearable: true },
  invites: { title: 'Convites', help: 'Possui vinculos; somente a limpeza geral e permitida.', exportable: true, clearable: false, globalClearable: true },
  notifications: { title: 'Notificacoes', help: 'Campanhas, entregas e resultados da fila; limpeza somente geral para cancelar a fila com seguranca.', exportable: true, clearable: false, globalClearable: true },
  profileauthchallenges: { title: 'Desafios de acesso ao perfil', help: 'Codigos e links temporarios vinculados a contatos; nunca sao exportados e sao revogados na limpeza geral.', exportable: false, clearable: false, globalClearable: true },
  providerreceipts: { title: 'Recibos dos provedores', help: 'Estados de entrega recebidos dos canais; limpeza somente geral para nao competir com webhooks.', exportable: true, clearable: false, globalClearable: true },
  templatesets: { title: 'Conjuntos de templates', help: 'Possui referencias a templates; somente a limpeza geral e permitida.', exportable: true, clearable: false, globalClearable: true },
  templates: { title: 'Templates', help: 'Possui referencias; somente a limpeza geral remove itens do operador e preserva os de sistema.', exportable: true, clearable: false, globalClearable: true, filter: { systemManaged: { $ne: true } } },
  terms: { title: 'Termos e LGPD', help: 'Documentos legais publicados.', exportable: true, clearable: false },
  whatsappcloudwebhookevents: { title: 'Eventos do WhatsApp', help: 'Metadados do webhook; payload criptografado nao e exportado e a limpeza ocorre somente no escopo geral.', exportable: true, clearable: false, globalClearable: true }
});

for (const policy of Object.values(POLICY)) {
  if (policy.globalClearable === undefined) policy.globalClearable = policy.clearable;
}

const MAX_EXPORT_DOCUMENTS = 250_000;
const MAX_EXPORT_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_EXPORT_MEDIA_FILES = 10_000;
const GLOBAL_CLEAR_ORDER = Object.freeze([
  'adminnotifications', 'inboundemailalerts', 'providerreceipts', 'whatsappcloudwebhookevents',
  'notifications', 'consentevents', 'conversationmessages', 'conversations',
  'conversationbackups', 'inviteclicks', 'templatesets', 'contactgroups',
  'templates', 'invites', 'chatemailchallenges', 'profileauthchallenges', 'contacts'
]);

const SECRET_KEY = /(?:password|secret|token|authorization|cookie|credential|encrypted|hash|api[-_]?key|access[-_]?key|private[-_]?key)/i;
const MEDIA_CAPABILITY = /(\/api\/media\/)[a-f\d]{24}\.[A-Za-z0-9_-]{43}/gi;

function dbOrThrow(options = {}) {
  const db = options.db || mongoose.connection.db;
  if (!db || (!options.db && mongoose.connection.readyState !== 1)) {
    throw new ApiError(503, 'MongoDB indisponivel', null, 'MONGODB_UNAVAILABLE');
  }
  return db;
}

function jsonValue(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === 'ObjectId') return String(value);
  if (Buffer.isBuffer(value)) return '[BINARY_REDACTED]';
  if (typeof value === 'string') return value.replace(MEDIA_CAPABILITY, '$1[REDACTED_CAPABILITY]');
  if (Array.isArray(value)) return value.map((item) => jsonValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, jsonValue(child, childKey)]));
  }
  return value;
}

function resolvePolicy(key, capability) {
  if (key === 'all') return null;
  const policy = POLICY[key];
  if (!policy || !policy[capability]) {
    throw new ApiError(422, 'Collection protegida ou desconhecida', { collection: key }, 'STORAGE_COLLECTION_PROTECTED');
  }
  return policy;
}

function confirmationPhrase(db, key) {
  return `LIMPAR ${db.databaseName}/${key}`;
}

async function collectionMetadata(options = {}) {
  const db = dbOrThrow(options);
  const descriptors = await db.listCollections({}, { nameOnly: true }).toArray();
  const stored = new Set(descriptors.map((item) => item.name));
  const entries = await Promise.all(Object.entries(POLICY).map(async ([key, policy]) => ({
    key,
    collection: key,
    title: policy.title,
    help: policy.help,
    exportable: policy.exportable,
    clearable: policy.clearable,
    count: stored.has(key) ? await db.collection(key).countDocuments(policy.filter || {}) : 0,
    confirmationPhrase: policy.clearable ? confirmationPhrase(db, key) : null
  })));
  const protectedCollections = [...stored]
    .filter((name) => !POLICY[name] && !name.startsWith('system.'))
    .map((name) => ({ key: name, collection: name, title: name, help: 'Collection interna protegida.', exportable: false, clearable: false, confirmationPhrase: null }));
  const operation = await maintenance.current({ db }).catch(() => null);
  return {
    database: db.databaseName,
    global: {
      key: 'all',
      title: 'Todas as collections permitidas',
      help: 'A limpeza geral pausa e invalida a fila, remove dados operacionais e desafios de contatos em etapas idempotentes. Configuracoes, administradores, sessoes administrativas, auditoria e collections internas ficam excluidos da operacao e permanecem protegidos. A operacao nao e uma transacao unica: em caso de falha, o status parcial fica auditado e uma nova execucao retoma a limpeza com seguranca.',
      exportable: true,
      clearable: true,
      confirmationPhrase: confirmationPhrase(db, 'all'),
      operation: operation ? {
        operationId: operation.operationId || null,
        scope: operation.scope || null,
        status: operation.status || 'idle',
        startedAt: operation.startedAt || null,
        completedAt: operation.completedAt || null,
        currentStep: operation.currentStep || null,
        completedSteps: operation.completedSteps || [],
        counts: operation.counts || operation.result?.counts || {},
        error: operation.error ? { code: operation.error.code, message: operation.error.message } : null
      } : null
    },
    collections: [...entries, ...protectedCollections].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  };
}

function exportKeys(scope) {
  resolvePolicy(scope, 'exportable');
  return scope === 'all' ? Object.keys(POLICY).filter((key) => POLICY[key].exportable) : [scope];
}

async function exportPlan(dbInput, scope, includeMedia = false) {
  const db = dbOrThrow({ db: dbInput });
  const keys = exportKeys(scope);
  const counts = {};
  for (const key of keys) counts[key] = await db.collection(key).countDocuments(POLICY[key].filter || {});
  const documentCount = Object.values(counts).reduce((total, count) => total + count, 0);
  if (documentCount > MAX_EXPORT_DOCUMENTS) {
    throw new ApiError(413, 'Exportacao excede o limite seguro de documentos', { documentCount, maxDocuments: MAX_EXPORT_DOCUMENTS }, 'STORAGE_EXPORT_TOO_LARGE');
  }
  let mediaBytes = 0;
  let mediaCount = 0;
  if (includeMedia) {
    const rows = await db.collection(`${mediaManager.BUCKET_NAME}.files`).aggregate([
      { $match: { 'metadata.scope': 'whatsapp_template', $or: [{ 'metadata.status': 'retained' }, { 'metadata.status': { $exists: false } }] } },
      { $group: { _id: null, total: { $sum: '$length' }, count: { $sum: 1 } } }
    ]).toArray();
    mediaBytes = Number(rows[0]?.total || 0);
    mediaCount = Number(rows[0]?.count || 0);
    if (mediaBytes > MAX_EXPORT_MEDIA_BYTES || mediaCount > MAX_EXPORT_MEDIA_FILES) {
      throw new ApiError(413, 'Exportacao excede o limite seguro de midias', {
        mediaBytes,
        mediaCount,
        maxMediaBytes: MAX_EXPORT_MEDIA_BYTES,
        maxMediaFiles: MAX_EXPORT_MEDIA_FILES
      }, 'STORAGE_EXPORT_TOO_LARGE');
    }
  }
  return { keys, counts, documentCount, mediaBytes, mediaCount };
}

function waitForDrain(stream) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.off('drain', onDrain);
      stream.off('close', onClose);
      stream.off('error', onError);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('Cliente encerrou a exportacao JSON antes da conclusao')); };
    const onError = (error) => { cleanup(); reject(error); };
    stream.once('drain', onDrain);
    stream.once('close', onClose);
    stream.once('error', onError);
  });
}

async function write(stream, chunk) {
  if (stream.destroyed || stream.writableEnded) {
    throw new Error('Cliente encerrou a exportacao JSON antes da conclusao');
  }
  if (!stream.write(chunk)) await waitForDrain(stream);
}

async function writeCollectionJson(stream, db, key) {
  const policy = POLICY[key];
  const cursor = db.collection(key).find(policy.filter || {}).sort({ _id: 1 });
  let first = true;
  let count = 0;
  try {
    await write(stream, '[');
    for await (const document of cursor) {
      if (!first) await write(stream, ',');
      await write(stream, JSON.stringify(jsonValue(document)));
      first = false;
      count += 1;
    }
    await write(stream, ']');
    return count;
  } finally {
    await cursor.close?.().catch?.(() => undefined);
  }
}

async function writeJsonExport(stream, scope, options = {}) {
  const db = dbOrThrow(options);
  const { keys } = options.plan || await exportPlan(db, scope, false);
  const counts = {};
  await write(stream, `{"exportedAt":${JSON.stringify(new Date().toISOString())},"scope":${JSON.stringify(scope)},"collections":`);
  await write(stream, '{');
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (index) await write(stream, ',');
    await write(stream, `${JSON.stringify(key)}:`);
    counts[key] = await writeCollectionJson(stream, db, key);
  }
  await write(stream, '}}');
  return { scope, counts };
}

function jsonArrayTransform() {
  let first = true;
  return new Transform({
    writableObjectMode: true,
    transform(document, _encoding, callback) {
      const prefix = first ? '[' : ',';
      first = false;
      callback(null, `${prefix}${JSON.stringify(jsonValue(document))}`);
    },
    flush(callback) {
      callback(null, first ? '[]' : ']');
    }
  });
}

function safeArchiveName(value) {
  const extension = path.extname(String(value || ''));
  const basename = path.basename(String(value || 'arquivo'), extension)
    .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'arquivo';
  return `${basename}${extension.toLowerCase().slice(0, 12)}`;
}

function appendArchiveStream(archive, source, entry, relatedStreams = []) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const streams = [source, ...relatedStreams].filter(Boolean);
    const cleanup = () => {
      archive.off('entry', onEntry);
      archive.off('error', onArchiveError);
      for (const stream of streams) stream.off?.('error', onSourceError);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onEntry = (processed) => {
      if (processed?.name === entry.name) finish(resolve);
    };
    const onArchiveError = (error) => finish(reject, error);
    const onSourceError = (error) => {
      archive.abort();
      finish(reject, error);
    };
    archive.on('entry', onEntry);
    archive.once('error', onArchiveError);
    for (const stream of streams) stream.once?.('error', onSourceError);
    archive.append(source, entry);
  });
}

async function streamZip(res, scope, options = {}) {
  const db = dbOrThrow(options);
  const includeMedia = scope === 'all' || scope === 'templates';
  const plan = options.plan || await exportPlan(db, scope, includeMedia);
  const { keys, counts } = plan;
  const archive = archiver('zip', { zlib: { level: 6 } });
  // finalize() indica que o archiver terminou de produzir dados, mas nao que a
  // resposta HTTP terminou de grava-los. A operacao/auditoria so e concluida
  // depois de `finish`; erros do archive, response ou fechamento antecipado
  // rejeitam a mesma Promise.
  const completed = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    archive.once('error', (error) => finish(reject, error));
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') finish(reject, error);
    });
    res.once('finish', () => finish(resolve));
    res.once('close', () => {
      if (!res.writableFinished) {
        finish(reject, new Error('Cliente encerrou a exportacao ZIP antes da conclusao'));
      }
    });
    res.once('error', (error) => finish(reject, error));
  });
  // O await ocorre somente apos todas as entradas serem anexadas; marque a
  // Promise como observada desde ja para evitar rejection sem handler se um
  // source falhar antes de finalize().
  completed.catch(() => undefined);
  archive.pipe(res);
  for (const key of keys) {
    const source = db.collection(key).find(POLICY[key].filter || {}).sort({ _id: 1 }).stream();
    const transformed = source.pipe(jsonArrayTransform());
    await appendArchiveStream(archive, transformed, { name: `collections/${key}.json` }, [source]);
  }
  const mediaFilter = {
    'metadata.scope': 'whatsapp_template',
    $or: [
      { 'metadata.status': 'retained' },
      { 'metadata.status': { $exists: false } }
    ]
  };
  if (scope === 'templates') {
    mediaFilter.$and = [{ $or: [
      { 'metadata.purpose': 'template' },
      { 'metadata.purpose': { $exists: false } }
    ] }];
  }
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: mediaManager.BUCKET_NAME });
  const manifest = [];
  if (includeMedia) {
    const files = db.collection(`${mediaManager.BUCKET_NAME}.files`)
      .find(mediaFilter).sort({ _id: 1 });
    // Nao materialize metadados de todas as midias em memoria. O cursor e os
    // conteudos GridFS seguem em streaming para o ZIP.
    for await (const file of files) {
      const filename = `api-media-${file._id}--${safeArchiveName(file.metadata?.originalFilename || file.filename)}`;
      const entry = `media/${filename}`;
      manifest.push({
        assetId: String(file._id),
        sourceUrl: `${envApiPrefix()}/media/${file._id}.[REDACTED_CAPABILITY]`,
        filename: file.metadata?.originalFilename || file.filename,
        archiveName: entry,
        size: file.length,
        mediaType: file.metadata?.mediaType || null
      });
      const download = bucket.openDownloadStream(file._id);
      await appendArchiveStream(archive, download, { name: entry, date: file.uploadDate || new Date(0) });
    }
  }
  archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), scope, counts, media: manifest }, null, 2), { name: 'manifest.json' });
  await archive.finalize();
  await completed;
  return { scope, counts, mediaCount: manifest.length };
}

async function clearStorage(scope, confirmation, options = {}) {
  const db = dbOrThrow(options);
  resolvePolicy(scope, 'clearable');
  const expected = confirmationPhrase(db, scope);
  if (confirmation !== expected) {
    throw new ApiError(422, 'Confirmacao de limpeza incorreta', { expected }, 'STORAGE_CONFIRMATION_MISMATCH');
  }
  const keys = scope === 'all'
    ? GLOBAL_CLEAR_ORDER.filter((key) => POLICY[key]?.globalClearable)
    : [scope];
  const operation = await maintenance.acquire(scope, {
    actor: options.actor,
    requestId: options.requestId
  }, { db });
  const progress = { currentStep: 'preflight', completedSteps: [], counts: {} };
  let queuePaused = false;
  try {
    const preflightCounts = {};
    for (const key of keys) preflightCounts[key] = await db.collection(key).countDocuments(POLICY[key].filter || {});
    const requiresQueueMaintenance = keys.includes('notifications');
    const activeNotifications = requiresQueueMaintenance
      ? await db.collection('notifications').countDocuments({
        $or: [{ status: { $in: ['queued', 'processing'] } }, { enqueuePending: true }]
      })
      : 0;
    const preflight = { counts: preflightCounts, activeNotifications };
    let queue = { skipped: true, reason: 'scope-without-notifications' };
    let invalidation = { modifiedCount: 0 };
    if (requiresQueueMaintenance) {
      await maintenance.heartbeat(operation.operationId, { preflight, currentStep: 'queue-drain' }, { db });
      queuePaused = true;
      queue = await queueService.beginStorageMaintenance();
      progress.completedSteps.push('queue-drain');
      await maintenance.heartbeat(operation.operationId, {
        currentStep: 'notification-invalidation',
        completedSteps: progress.completedSteps,
        queue
      }, { db });
      invalidation = await db.collection('notifications').updateMany(
        { $or: [{ status: { $in: ['queued', 'processing'] } }, { enqueuePending: true }] },
        {
          $set: {
            status: 'cancelled',
            enqueuePending: false,
            completedAt: new Date(),
            errorCode: 'STORAGE_CLEAR_CANCELLED',
            errorMessage: 'Cancelada por limpeza administrativa do armazenamento'
          },
          $unset: { processingToken: 1, processingJobId: 1, processingHeartbeatAt: 1, queueScheduledAt: 1 }
        }
      );
      progress.completedSteps.push('notification-invalidation');
    } else {
      progress.completedSteps.push('queue-maintenance-skipped');
      await maintenance.heartbeat(operation.operationId, {
        preflight,
        currentStep: 'asset-collection',
        completedSteps: progress.completedSteps,
        queue
      }, { db });
    }
    const mediaIds = new Set();
    const backupFileIds = new Map();
    for (const id of operation.previous?.pendingAssets?.mediaIds || []) mediaIds.add(String(id));
    for (const id of operation.previous?.pendingAssets?.backupFileIds || []) backupFileIds.set(String(id), id);
    const collectDetachedAssets = async () => {
      if (keys.includes('templates')) {
        const templates = await db.collection('templates').find(POLICY.templates.filter, { projection: { payload: 1 } }).toArray();
        for (const id of templates.flatMap(templatesManager.templateMediaAssetIds)) mediaIds.add(String(id));
      }
      if (keys.includes('conversationbackups')) {
        const ids = await db.collection('conversationbackups').distinct('gridFsFileId', { gridFsFileId: { $ne: null } });
        for (const id of ids) backupFileIds.set(String(id), id);
      }
    };
    await collectDetachedAssets();
    // Persista os IDs antes de apagar os documentos que continham as únicas
    // referências. Se o processo cair durante o GridFS cleanup, uma retomada
    // consegue repetir a remoção dos mesmos binários com idempotência.
    await maintenance.heartbeat(operation.operationId, {
      currentStep: 'asset-snapshot',
      completedSteps: progress.completedSteps,
      pendingAssets: {
        mediaIds: [...mediaIds],
        backupFileIds: [...backupFileIds.keys()]
      }
    }, { db });
    progress.completedSteps.push('asset-snapshot');
    // Duas passagens idempotentes: a primeira remove o estado conhecido e a
    // segunda absorve gravacoes que ja estavam em voo quando o lock foi adquirido.
    for (let pass = 1; pass <= 3; pass += 1) {
      progress.currentStep = `delete-pass-${pass}`;
      await maintenance.heartbeat(operation.operationId, {
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        counts: progress.counts
      }, { db });
      await collectDetachedAssets();
      await maintenance.heartbeat(operation.operationId, {
        currentStep: `${progress.currentStep}:asset-snapshot`,
        completedSteps: progress.completedSteps,
        counts: progress.counts,
        pendingAssets: {
          mediaIds: [...mediaIds],
          backupFileIds: [...backupFileIds.keys()]
        }
      }, { db });
      for (const key of keys) {
        const result = await db.collection(key).deleteMany(POLICY[key].filter || {});
        progress.counts[key] = Number(progress.counts[key] || 0) + Number(result.deletedCount || 0);
        await maintenance.heartbeat(operation.operationId, {
          currentStep: `${progress.currentStep}:${key}`,
          completedSteps: progress.completedSteps,
          counts: progress.counts
        }, { db });
      }
      progress.completedSteps.push(progress.currentStep);
      await new Promise((resolve) => setImmediate(resolve));
    }
    progress.currentStep = 'asset-cleanup';
    await maintenance.heartbeat(operation.operationId, {
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      counts: progress.counts
    }, { db });
    if (mediaIds.size) await templatesManager.cleanupDetachedTemplateMedia([...mediaIds]);
    if (backupFileIds.size) {
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: backupStorage.BUCKET_NAME });
      for (const fileId of backupFileIds.values()) {
        try { await bucket.delete(fileId); } catch (error) {
          if (error?.code !== 26 && !/FileNotFound/i.test(String(error?.message || ''))) throw error;
        }
      }
    }
    progress.completedSteps.push('asset-cleanup');
    await maintenance.heartbeat(operation.operationId, {
      currentStep: 'asset-cleanup-completed',
      completedSteps: progress.completedSteps,
      counts: progress.counts,
      pendingAssets: { mediaIds: [], backupFileIds: [] }
    }, { db });
    const residualCounts = {};
    for (const key of keys) {
      const count = await db.collection(key).countDocuments(POLICY[key].filter || {});
      if (count) residualCounts[key] = count;
    }
    if (Object.keys(residualCounts).length) {
      throw new ApiError(
        409,
        'A limpeza ficou parcial porque novas gravacoes terminaram durante a operacao; execute-a novamente',
        { operationId: operation.operationId, residualCounts },
        'STORAGE_CLEAR_PARTIAL'
      );
    }
    const result = {
      operationId: operation.operationId,
      resumed: operation.resumed,
      scope,
      counts: progress.counts,
      deleted: Object.values(progress.counts).reduce((total, count) => total + count, 0),
      queue: {
        ...queue,
        invalidatedNotifications: Number(invalidation.modifiedCount || 0)
      },
      consistency: 'staged-idempotent',
      note: 'A limpeza e executada em etapas retomaveis, nao como uma transacao unica do MongoDB.'
    };
    await maintenance.complete(operation.operationId, result, { db });
    return result;
  } catch (error) {
    error.storageProgress = { operationId: operation.operationId, ...progress };
    error.details = {
      ...(error.details || {}),
      operationId: operation.operationId,
      status: 'partial',
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      counts: progress.counts
    };
    await maintenance.fail(operation.operationId, error, progress, { db }).catch(() => undefined);
    throw error;
  } finally {
    if (queuePaused) await queueService.endStorageMaintenance().catch(() => undefined);
  }
}

function envApiPrefix() {
  return String(require('../config/env').env.apiPrefix || '/api').replace(/\/$/, '');
}

async function auditList(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { action: /^storage\.(export|clear)\./ };
  if (query.action) filter.action = new RegExp(`^storage\\.${query.action}\\.`);
  if (query.scope) filter['context.scope'] = query.scope;
  const [items, total] = await Promise.all([
    Log.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Log.countDocuments(filter)
  ]);
  return pageResult(items, total, page, limit);
}

module.exports = {
  POLICY, jsonValue, collectionMetadata, writeJsonExport, streamZip, clearStorage,
  auditList, confirmationPhrase, safeArchiveName, resolvePolicy, exportPlan
};
