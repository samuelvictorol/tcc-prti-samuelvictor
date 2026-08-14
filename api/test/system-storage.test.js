const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough, Readable } = require('node:stream');
const storageManager = require('../src/managers/system-storage.manager');

function asyncCursor(items) {
  return {
    sort() { return this; },
    async toArray() { return [...items]; },
    stream() { return Readable.from(items, { objectMode: true }); },
    async close() {},
    async *[Symbol.asyncIterator]() { for (const item of items) yield item; }
  };
}

function fakeDb(documents = {}) {
  const operations = new Map();
  return {
    databaseName: 'notify_test',
    listCollections() {
      return { async toArray() { return Object.keys(documents).map((name) => ({ name })); } };
    },
    collection(name) {
      if (name === 'storageoperations') {
        return {
          async findOne(filter) { return operations.get(filter._id) || null; },
          async updateOne(filter, update, options = {}) {
            let current = operations.get(filter._id);
            if (!current && options.upsert) {
              current = { _id: filter._id, ...(update.$setOnInsert || {}) };
              operations.set(filter._id, current);
            }
            if (!current) return { matchedCount: 0, modifiedCount: 0 };
            Object.assign(current, update.$set || {});
            for (const [key, amount] of Object.entries(update.$inc || {})) current[key] = Number(current[key] || 0) + amount;
            return { matchedCount: 1, modifiedCount: 1 };
          }
        };
      }
      return {
        countDocuments: async () => (documents[name] || []).length,
        find: () => asyncCursor(documents[name] || []),
        aggregate: () => ({ async toArray() { return []; } }),
        distinct: async (key) => (documents[name] || []).map((item) => item[key]).filter(Boolean),
        async updateMany() { return { matchedCount: (documents[name] || []).length, modifiedCount: (documents[name] || []).length }; },
        async deleteMany() {
          const deletedCount = (documents[name] || []).length;
          documents[name] = [];
          return { deletedCount };
        }
      };
    }
  };
}

async function captureJson(scope, db) {
  const stream = new PassThrough();
  let output = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { output += chunk; });
  await storageManager.writeJsonExport(stream, scope, { db });
  stream.end();
  await new Promise((resolve) => stream.on('end', resolve));
  return JSON.parse(output);
}

test('exportacao JSON produz documento valido e remove segredos e capability de midia', async () => {
  const db = fakeDb({
    contacts: [{
      _id: 'contact-1',
      emailEncrypted: 'ciphertext',
      passwordHash: 'hash',
      authorizationHeader: 'Bearer segredo',
      tokenValue: 'token-secreto',
      nested: { apiKey: 'chave-secreta', safe: 'visivel' },
      publicLabel: 'Contato seguro',
      avatar: 'https://notify.example/api/media/507f1f77bcf86cd799439011.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    }]
  });
  const exported = await captureJson('contacts', db);
  assert.equal(exported.scope, 'contacts');
  assert.equal(exported.collections.contacts[0].publicLabel, 'Contato seguro');
  assert.equal(exported.collections.contacts[0].emailEncrypted, '[REDACTED]');
  assert.equal(exported.collections.contacts[0].passwordHash, '[REDACTED]');
  assert.equal(exported.collections.contacts[0].authorizationHeader, '[REDACTED]');
  assert.equal(exported.collections.contacts[0].tokenValue, '[REDACTED]');
  assert.equal(exported.collections.contacts[0].nested.apiKey, '[REDACTED]');
  assert.equal(exported.collections.contacts[0].nested.safe, 'visivel');
  assert.match(exported.collections.contacts[0].avatar, /\[REDACTED_CAPABILITY\]/);
});

test('metadata protege auth, configuracao e auditoria e fornece frase forte', async () => {
  const db = fakeDb({ contacts: [{}], admins: [{}], settings: [{}], logs: [{}] });
  const metadata = await storageManager.collectionMetadata({ db });
  assert.equal(metadata.global.confirmationPhrase, 'LIMPAR notify_test/all');
  const contacts = metadata.collections.find((item) => item.key === 'contacts');
  assert.equal(contacts.exportable, true);
  assert.equal(contacts.clearable, false);
  for (const key of ['admins', 'settings', 'logs']) {
    const item = metadata.collections.find((entry) => entry.key === key);
    assert.equal(item.exportable, false);
    assert.equal(item.clearable, false);
  }
  assert.match(metadata.global.help, /etapas idempotentes/);
  assert.match(metadata.global.help, /nao e uma transacao unica/);
  for (const key of ['notifications', 'providerreceipts', 'whatsappcloudwebhookevents']) {
    const item = metadata.collections.find((entry) => entry.key === key);
    assert.equal(item.exportable, true);
    assert.equal(item.clearable, false);
  }
  for (const key of ['profileauthchallenges', 'chatemailchallenges']) {
    const item = metadata.collections.find((entry) => entry.key === key);
    assert.equal(item.exportable, false);
    assert.equal(item.clearable, false);
  }
});

test('collection protegida e confirmacao incorreta sao rejeitadas', async () => {
  assert.throws(
    () => storageManager.resolvePolicy('settings', 'exportable'),
    (error) => error.code === 'STORAGE_COLLECTION_PROTECTED'
  );
  const db = fakeDb({ conversationbackups: [] });
  await assert.rejects(
    storageManager.clearStorage('conversationbackups', 'LIMPAR errado', { db }),
    (error) => error.code === 'STORAGE_CONFIRMATION_MISMATCH'
  );
});

test('nome de arquivo do ZIP nao permite travessia de diretorio', () => {
  const safe = storageManager.safeArchiveName('../../Minha imagem perigosa.PNG');
  assert.equal(safe, 'Minha-imagem-perigosa.png');
  assert.equal(safe.includes('..'), false);
  assert.equal(safe.includes('/'), false);
});

test('exportacao ZIP conclui o stream antes de retornar', async () => {
  const db = fakeDb({ contacts: [{ _id: 'contact-1', publicLabel: 'Seguro' }] });
  const response = new PassThrough();
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  const result = await storageManager.streamZip(response, 'contacts', { db });
  assert.equal(result.counts.contacts, 1);
  assert.equal(response.writableFinished, true);
  assert.equal(Buffer.concat(chunks).subarray(0, 2).toString(), 'PK');
});

test('limpeza geral cancela fila e remove desafios de contato em passagens idempotentes', async () => {
  const documents = {
    notifications: [{ _id: 'notification-1', status: 'queued', enqueuePending: true }],
    profileauthchallenges: [{ _id: 'profile-challenge', contact: 'contact-1' }],
    chatemailchallenges: [{ _id: 'email-challenge', contact: 'contact-1' }],
    contacts: [{ _id: 'contact-1' }],
    templates: [],
    conversationbackups: []
  };
  const db = fakeDb(documents);
  const queueService = require('../src/services/queue.service');
  const originalBegin = queueService.beginStorageMaintenance;
  const originalEnd = queueService.endStorageMaintenance;
  let resumed = false;
  queueService.beginStorageMaintenance = async () => ({ cancelledQueued: 1, cancelledInline: 0, activeDrained: true });
  queueService.endStorageMaintenance = async () => { resumed = true; };
  try {
    const result = await storageManager.clearStorage('all', 'LIMPAR notify_test/all', { db, actor: 'admin-1' });
    assert.equal(result.queue.invalidatedNotifications, 1);
    assert.equal(result.counts.profileauthchallenges, 1);
    assert.equal(result.counts.chatemailchallenges, 1);
    assert.equal(result.counts.contacts, 1);
    assert.equal(result.consistency, 'staged-idempotent');
    assert.equal(resumed, true);
    assert.equal(documents.profileauthchallenges.length, 0);
    assert.equal(documents.chatemailchallenges.length, 0);
  } finally {
    queueService.beginStorageMaintenance = originalBegin;
    queueService.endStorageMaintenance = originalEnd;
  }
});

test('limpeza isolada de backups nao pausa nem cancela a fila de notificacoes', async () => {
  const documents = { conversationbackups: [], notifications: [{ _id: 'notification-1', status: 'queued' }] };
  const db = fakeDb(documents);
  const queueService = require('../src/services/queue.service');
  const originalBegin = queueService.beginStorageMaintenance;
  const originalEnd = queueService.endStorageMaintenance;
  let beginCalls = 0;
  let endCalls = 0;
  queueService.beginStorageMaintenance = async () => { beginCalls += 1; return {}; };
  queueService.endStorageMaintenance = async () => { endCalls += 1; };
  try {
    const result = await storageManager.clearStorage(
      'conversationbackups',
      'LIMPAR notify_test/conversationbackups',
      { db, actor: 'admin-1' }
    );
    assert.equal(beginCalls, 0);
    assert.equal(endCalls, 0);
    assert.equal(result.queue.skipped, true);
    assert.equal(documents.notifications[0].status, 'queued');
  } finally {
    queueService.beginStorageMaintenance = originalBegin;
    queueService.endStorageMaintenance = originalEnd;
  }
});
