const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');
const request = require('supertest');
const mongoose = require('mongoose');
const { createApp, isPublicMediaDownload } = require('../src/app');
const authManager = require('../src/managers/auth.manager');
const mediaManager = require('../src/managers/template-media.manager');
const templatesManager = require('../src/managers/templates.manager');
const Template = require('../src/models/template.model');
const { env } = require('../src/config/env');
const { apiLimiter, mediaLimiter } = require('../src/middlewares/security');
const { safeRequestPath } = require('../src/utils/request-path');
const { isSafePublicHttpsUrl } = require('../src/utils/urls');

function restoreAfter(context, target, key, value = target[key]) {
  context.after(() => { target[key] = value; });
}

test('validacao separa imagem, video e documento por MIME, extensao e tamanho', () => {
  assert.deepEqual(
    mediaManager.validateUpload({ originalFilename: 'foto.PNG', mimetype: 'image/png', size: 512 }, 'image'),
    {
      filename: 'foto.PNG',
      extension: '.png',
      mimeType: 'image/png',
      mediaType: 'image',
      size: 512,
      maxBytes: 5 * 1024 * 1024
    }
  );
  assert.equal(
    mediaManager.validateUpload({ originalFilename: 'video.mp4', mimetype: 'video/mp4', size: 1024 }).mediaType,
    'video'
  );
  assert.equal(
    mediaManager.validateUpload({ originalFilename: 'arquivo.pdf', mimetype: 'application/pdf', size: 1024 }).mediaType,
    'document'
  );
  assert.throws(
    () => mediaManager.validateUpload({ originalFilename: 'foto.exe', mimetype: 'image/png', size: 10 }, 'image'),
    (error) => error.code === 'TEMPLATE_MEDIA_EXTENSION_INVALID' && error.statusCode === 415
  );
  assert.throws(
    () => mediaManager.validateUpload({ originalFilename: 'foto.png', mimetype: 'application/octet-stream', size: 10 }, 'image'),
    (error) => error.code === 'TEMPLATE_MEDIA_MIME_INVALID' && error.statusCode === 415
  );
  assert.throws(
    () => mediaManager.validateUpload({ originalFilename: 'foto.png', mimetype: 'image/png', size: 5 * 1024 * 1024 + 1 }, 'image'),
    (error) => error.code === 'TEMPLATE_MEDIA_TOO_LARGE' && error.details.maxBytes === 5 * 1024 * 1024
  );
});

test('URL publica usa capability estavel assinada e rejeita adulteracao', (context) => {
  restoreAfter(context, env, 'mediaPublicBaseUrl');
  env.mediaPublicBaseUrl = 'https://notify.example';
  const id = '507f1f77bcf86cd799439011';
  const token = mediaManager.publicToken(id);
  assert.equal(mediaManager.parsePublicToken(token), id);
  assert.equal(mediaManager.publicUrl(id), 'https://notify.example/api/media/' + token);
  assert.throws(
    () => mediaManager.parsePublicToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')),
    (error) => error.code === 'TEMPLATE_MEDIA_NOT_FOUND' && error.statusCode === 404
  );
});

test('capability de download e redigida dos logs HTTP', () => {
  assert.equal(
    safeRequestPath({ path: '/api/media/507f1f77bcf86cd799439011.assinatura-secreta' }),
    '/api/media/:token'
  );
  assert.equal(safeRequestPath({ path: '/api/templates' }), '/api/templates');
});

test('download publico de midia usa limitador proprio e exige host realmente publico', () => {
  assert.equal(isPublicMediaDownload({ method: 'GET', path: '/media/token-assinado' }), true);
  assert.equal(isPublicMediaDownload({ method: 'HEAD', path: '/media/token-assinado' }), true);
  assert.equal(isPublicMediaDownload({ method: 'POST', path: '/media/' }), false);
  assert.equal(isPublicMediaDownload({ method: 'GET', path: '/templates' }), false);
  assert.notEqual(mediaLimiter, apiLimiter);
  assert.equal(isSafePublicHttpsUrl('https://cdn.notify.example/media'), true);
  assert.equal(isSafePublicHttpsUrl('https://api-u4nu/media'), false);
  assert.equal(isSafePublicHttpsUrl('https://media.internal/file'), false);
  assert.equal(isSafePublicHttpsUrl('https://media.lan/file'), false);
});

test('intervalos HTTP suportam streaming parcial de video', () => {
  assert.deepEqual(mediaManager.parseByteRange('bytes=10-19', 100), { start: 10, end: 19, length: 10 });
  assert.deepEqual(mediaManager.parseByteRange('bytes=90-', 100), { start: 90, end: 99, length: 10 });
  assert.deepEqual(mediaManager.parseByteRange('bytes=-8', 100), { start: 92, end: 99, length: 8 });
  assert.throws(
    () => mediaManager.parseByteRange('bytes=100-120', 100),
    (error) => error.code === 'TEMPLATE_MEDIA_RANGE_INVALID' && error.statusCode === 416
  );
});

test('upload grava o binario em GridFS e retorna contrato amigavel sem base64', async (context) => {
  const temporary = path.join(os.tmpdir(), 'notify-template-media-' + process.pid + '-' + Date.now() + '.png');
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  await fs.writeFile(temporary, bytes);
  context.after(() => fs.unlink(temporary).catch(() => {}));
  restoreAfter(context, env, 'mediaPublicBaseUrl');
  env.mediaPublicBaseUrl = 'https://notify.example';

  const storedId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  let stored = Buffer.alloc(0);
  let metadata;
  let hashUpdate;
  const bucket = {
    openUploadStream(_filename, options) {
      metadata = options.metadata;
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          stored = Buffer.concat([stored, chunk]);
          callback();
        }
      });
      writable.id = storedId;
      return writable;
    },
    async delete() {
      assert.fail('arquivo valido nao deve ser removido');
    }
  };
  const db = {
    collection(name) {
      assert.equal(name, 'templateMedia.files');
      return { async updateOne(filter, update) { hashUpdate = { filter, update }; } };
    }
  };

  const result = await mediaManager.upload({
    filepath: temporary,
    originalFilename: 'cabecalho.png',
    mimetype: 'image/png',
    size: bytes.length
  }, 'image', 'admin-1', { bucket, db });

  assert.deepEqual(stored, bytes);
  assert.equal(metadata.scope, 'whatsapp_template');
  assert.equal(metadata.uploadedBy, 'admin-1');
  assert.equal(metadata.purpose, 'template');
  assert.equal(metadata.status, 'pending');
  assert.equal(metadata.expiresAt instanceof Date, true);
  assert.match(hashUpdate.update.$set['metadata.sha256'], /^[a-f\d]{64}$/);
  assert.deepEqual(Object.keys(result), ['id', 'url', 'mimeType', 'mediaType', 'filename', 'size']);
  assert.equal(result.id, String(storedId));
  assert.equal(result.mediaType, 'image');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.filename, 'cabecalho.png');
  assert.equal(result.size, bytes.length);
  assert.match(result.url, /^https:\/\/notify\.example\/api\/media\/[a-f\d]{24}\.[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(result), /base64|iVBOR/i);
});

test('ciclo de vida reconhece referencias legadas pelo link publico assinado', (context) => {
  restoreAfter(context, env, 'mediaPublicBaseUrl');
  env.mediaPublicBaseUrl = 'https://notify.example';
  const id = '507f1f77bcf86cd799439011';
  const url = mediaManager.publicUrl(id);

  assert.equal(mediaManager.assetIdFromPublicUrl(url), id);
  assert.equal(mediaManager.assetIdFromPublicUrl('https://cdn.example/foto.png'), null);
  assert.deepEqual(templatesManager.templateMediaAssetIds({
    payload: {
      builder: {
        components: [{
          type: 'header',
          parameters: [{ type: 'image', fixedValue: url, mediaAssetId: '' }]
        }]
      }
    }
  }), [id]);
});

test('limpeza remove GridFS somente quando nenhuma outra template referencia a midia', async (context) => {
  const first = '507f1f77bcf86cd799439011';
  const second = '507f191e810c19729de860ea';
  restoreAfter(context, Template, 'distinct');
  restoreAfter(context, Template, 'find');
  restoreAfter(context, mediaManager, 'removeRetained');
  Template.distinct = async () => [new mongoose.Types.ObjectId(second)];
  Template.find = (filter) => {
    assert.deepEqual(filter, { channel: 'whatsapp_cloud', payload: { $exists: true } });
    return { select: () => ({ lean: async () => [] }) };
  };
  let removedIds;
  mediaManager.removeRetained = async (ids) => {
    removedIds = ids;
    return { removed: ids.length };
  };

  assert.deepEqual(await templatesManager.cleanupDetachedTemplateMedia([first, second]), { removed: 1 });
  assert.deepEqual(removedIds, [first]);
});

test('limpeza preserva GridFS referenciado apenas por URL assinada legada', async (context) => {
  restoreAfter(context, env, 'mediaPublicBaseUrl');
  env.mediaPublicBaseUrl = 'https://notify.example';
  const id = '507f1f77bcf86cd799439011';
  restoreAfter(context, Template, 'distinct');
  restoreAfter(context, Template, 'find');
  restoreAfter(context, mediaManager, 'removeRetained');
  Template.distinct = async () => [];
  const legacyUrl = mediaManager.publicUrl(id).replace('https://notify.example', 'https://dominio-antigo.example');
  Template.find = (filter) => {
    assert.deepEqual(filter, { channel: 'whatsapp_cloud', payload: { $exists: true } });
    return { select: () => ({ lean: async () => [{
      payload: {
        builder: {
          components: [{ parameters: [{ type: 'image', fixedValue: legacyUrl }] }]
        }
      }
    }] }) };
  };
  let removedIds;
  mediaManager.removeRetained = async (ids) => {
    removedIds = ids;
    return { removed: ids.length };
  };

  assert.deepEqual(await templatesManager.cleanupDetachedTemplateMedia([id]), { removed: 0 });
  assert.deepEqual(removedIds, []);
});

test('assinatura real bloqueia executavel renomeado como imagem', async (context) => {
  const temporary = path.join(os.tmpdir(), 'notify-template-media-spoof-' + process.pid + '-' + Date.now() + '.png');
  await fs.writeFile(temporary, Buffer.from('MZ-conteudo-executavel'));
  context.after(() => fs.unlink(temporary).catch(() => {}));
  await assert.rejects(
    () => mediaManager.validateContentSignature(temporary, 'image/png'),
    (error) => error.code === 'TEMPLATE_MEDIA_CONTENT_INVALID' && error.statusCode === 415
  );
});

test('ciclo de vida retém template salvo e descarta somente rascunho do proprio admin', async () => {
  const storedId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  let update;
  const db = {
    collection(name) {
      assert.equal(name, 'templateMedia.files');
      return {
        async updateMany(filter, change) {
          update = { filter, change };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      };
    }
  };
  assert.deepEqual(await mediaManager.retain([String(storedId)], { db }), { retained: 1 });
  assert.deepEqual(update.change.$unset, {
    'metadata.expiresAt': '',
    'metadata.tombstonedAt': '',
    'metadata.deleteClaimedAt': ''
  });
  assert.equal(update.change.$set['metadata.status'], 'retained');
  assert.deepEqual(
    update.filter.$or[0]['metadata.status'].$in,
    ['pending', 'retained', 'orphaned', 'deleting']
  );

  let deleted;
  const bucket = {
    find(filter) {
      assert.equal(String(filter._id), String(storedId));
      assert.equal(filter['metadata.status'], 'pending');
      assert.equal(filter['metadata.uploadedBy'], 'admin-1');
      return { async next() { return { _id: storedId }; } };
    },
    async delete(id) { deleted = id; }
  };
  assert.deepEqual(await mediaManager.discardPending(String(storedId), 'admin-1', { bucket }), {
    id: String(storedId),
    removed: true
  });
  assert.equal(String(deleted), String(storedId));
  assert.throws(() => mediaManager.normalizePurpose('avatar'), /Finalidade do upload invalida/);
});

test('desvinculo agenda tombstone com carencia sem remover o binario imediatamente', async () => {
  const retainedId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const missingId = new mongoose.Types.ObjectId('507f191e810c19729de860ea');
  let update;
  const db = {
    collection(name) {
      assert.equal(name, 'templateMedia.files');
      return {
        async updateMany(filter, change) {
          update = { filter, change };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      };
    }
  };
  const now = new Date('2026-08-12T12:00:00.000Z');

  assert.deepEqual(
    await mediaManager.removeRetained([String(retainedId), String(missingId)], { db, now, graceMs: 60_000 }),
    { removed: 0, scheduled: 1 }
  );
  assert.equal(update.change.$set['metadata.status'], 'orphaned');
  assert.equal(update.change.$set['metadata.tombstonedAt'], now);
  assert.equal(update.change.$set['metadata.expiresAt'].getTime(), now.getTime() + 60_000);
});

test('job restaura tombstone referenciado e verifica duas vezes antes de excluir orfao', async () => {
  const restoredId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const removedId = new mongoose.Types.ObjectId('507f191e810c19729de860ea');
  const now = new Date('2026-08-13T12:00:00.000Z');
  let retainUpdate;
  const db = {
    collection() {
      return {
        find() {
          return {
            project() { return this; },
            limit() { return this; },
            async toArray() {
              return [restoredId, removedId].map((_id) => ({ _id, metadata: { status: 'orphaned' } }));
            }
          };
        },
        async findOneAndUpdate(filter) { return { _id: filter._id }; },
        async updateOne() { return { matchedCount: 1, modifiedCount: 1 }; },
        async updateMany(filter, change) {
          retainUpdate = { filter, change };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      };
    }
  };
  const deleted = [];
  const bucket = { async delete(id) { deleted.push(String(id)); } };
  const checks = new Map();
  const isReferenced = async (id) => {
    checks.set(id, (checks.get(id) || 0) + 1);
    return id === String(restoredId);
  };

  assert.deepEqual(
    await mediaManager.cleanupExpired({ db, bucket, now, isReferenced }),
    { removed: 1, restored: 1, skipped: 0, scanned: 2 }
  );
  assert.deepEqual(deleted, [String(removedId)]);
  assert.equal(checks.get(String(restoredId)), 1);
  assert.equal(checks.get(String(removedId)), 2);
  assert.equal(retainUpdate.change.$set['metadata.status'], 'retained');
});

test('job restaura atomically asset deleting que voltou a ser referenciado', async () => {
  const restoredId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const now = new Date('2026-08-13T12:00:00.000Z');
  let retainUpdate;
  let claimed = false;
  const db = {
    collection() {
      return {
        find() {
          return {
            project() { return this; },
            limit() { return this; },
            async toArray() {
              return [{
                _id: restoredId,
                metadata: {
                  status: 'deleting',
                  deleteClaimedAt: new Date('2026-08-13T11:59:00.000Z')
                }
              }];
            }
          };
        },
        async findOneAndUpdate() {
          claimed = true;
          return { _id: restoredId };
        },
        async updateMany(filter, change) {
          retainUpdate = { filter, change };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      };
    }
  };
  const deleted = [];
  const bucket = { async delete(id) { deleted.push(String(id)); } };

  assert.deepEqual(
    await mediaManager.cleanupExpired({
      db,
      bucket,
      now,
      isReferenced: async (id) => id === String(restoredId)
    }),
    { removed: 0, restored: 1, skipped: 0, scanned: 1 }
  );
  assert.deepEqual(deleted, []);
  assert.equal(claimed, false);
  assert.equal(retainUpdate.change.$set['metadata.status'], 'retained');
  assert.ok(retainUpdate.filter.$or[0]['metadata.status'].$in.includes('deleting'));
  assert.deepEqual(retainUpdate.change.$unset, {
    'metadata.expiresAt': '',
    'metadata.tombstonedAt': '',
    'metadata.deleteClaimedAt': ''
  });
});

test('endpoint POST /api/media exige login e aceita multipart no campo file', async (context) => {
  restoreAfter(context, authManager, 'authenticateAccess');
  restoreAfter(context, mediaManager, 'upload');
  authManager.authenticateAccess = async () => ({ id: 'admin-1' });
  let parsed;
  mediaManager.upload = async (file, mediaType, actorId, options) => {
    parsed = { file, mediaType, actorId, options };
    return {
      id: '507f1f77bcf86cd799439011',
      url: 'https://notify.example/api/media/token',
      mimeType: 'image/png',
      mediaType: 'image',
      filename: 'foto.png',
      size: 8
    };
  };
  const app = createApp();
  const unauthorized = await request(app).post('/api/media');
  assert.equal(unauthorized.status, 401);

  const response = await request(app)
    .post('/api/media')
    .set('Authorization', 'Bearer admin-token')
    .field('mediaType', 'image')
    .field('purpose', 'template')
    .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), {
      filename: 'foto.png',
      contentType: 'image/png'
    });
  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.filename, 'foto.png');
  assert.equal(parsed.mediaType, 'image');
  assert.equal(parsed.actorId, 'admin-1');
  assert.equal(parsed.options.purpose, 'template');
  assert.equal(parsed.file.originalFilename, 'foto.png');
});

test('GET publico transmite midia assinada sem exigir Bearer', async (context) => {
  restoreAfter(context, mediaManager, 'open');
  mediaManager.open = async (token, range) => {
    assert.equal(token, 'token-publico');
    assert.equal(range, undefined);
    return {
      id: '507f1f77bcf86cd799439011',
      url: 'https://notify.example/api/media/token-publico',
      mimeType: 'image/png',
      mediaType: 'image',
      filename: 'cabecalho.png',
      size: 4,
      range: null,
      stream: Readable.from(Buffer.from([1, 2, 3, 4]))
    };
  };
  const response = await request(createApp()).get('/api/media/token-publico');
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'image/png');
  assert.equal(response.headers['content-length'], '4');
  assert.deepEqual(response.body, Buffer.from([1, 2, 3, 4]));
});
