const test = require('node:test');
const assert = require('node:assert/strict');
const maintenance = require('../src/services/storage-maintenance.service');

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((child) => matches(document, child));
    if (value && typeof value === 'object' && '$ne' in value) return document[key] !== value.$ne;
    return document[key] === value;
  });
}

function fakeDb(initial = null) {
  let operation = initial ? { ...initial } : null;
  return {
    databaseName: 'notify_test',
    collection(name) {
      assert.equal(name, maintenance.COLLECTION);
      return {
        async findOne(filter) { return operation && matches(operation, filter) ? { ...operation } : null; },
        async updateOne(filter, update, options = {}) {
          if (!operation && options.upsert) operation = { _id: filter._id, ...(update.$setOnInsert || {}) };
          if (!operation || !matches(operation, filter)) return { matchedCount: 0, modifiedCount: 0 };
          Object.assign(operation, update.$set || {});
          for (const [key, amount] of Object.entries(update.$inc || {})) operation[key] = Number(operation[key] || 0) + amount;
          return { matchedCount: 1, modifiedCount: 1 };
        }
      };
    },
    value() { return operation; }
  };
}

test('lock de limpeza bloqueia gravacoes e registra conclusao', async () => {
  const db = fakeDb();
  const lock = await maintenance.acquire('all', { actor: 'admin-1', requestId: 'req-1' }, { db });
  assert.ok(lock.operationId);
  await assert.rejects(
    maintenance.assertWritesAllowed({ db }),
    (error) => error.code === 'STORAGE_MAINTENANCE_ACTIVE' && error.statusCode === 503
  );
  await maintenance.heartbeat(lock.operationId, { currentStep: 'delete-pass-1' }, { db });
  assert.equal(db.value().currentStep, 'delete-pass-1');
  await maintenance.complete(lock.operationId, { deleted: 3 }, { db });
  assert.equal(db.value().status, 'completed');
  assert.equal(await maintenance.assertWritesAllowed({ db }), null);
});

test('lock concorrente e rejeitado; operacao parcial pode ser retomada', async () => {
  const db = fakeDb();
  const first = await maintenance.acquire('all', {}, { db });
  await assert.rejects(
    maintenance.acquire('all', {}, { db }),
    (error) => error.code === 'STORAGE_CLEAR_LOCKED'
  );
  await maintenance.fail(first.operationId, new Error('interrompida'), {
    currentStep: 'contacts', completedSteps: ['queue-drain'], counts: { contacts: 2 }
  }, { db });
  const resumed = await maintenance.acquire('all', {}, { db });
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.previous.operationId, first.operationId);
});

test('retomada preserva snapshot de assets apenas para o mesmo escopo', async () => {
  const db = fakeDb();
  const first = await maintenance.acquire('all', {}, { db });
  await maintenance.heartbeat(first.operationId, {
    pendingAssets: { mediaIds: ['media-1'], backupFileIds: ['backup-1'] }
  }, { db });
  await maintenance.fail(first.operationId, new Error('interrompida'), {}, { db });
  const resumed = await maintenance.acquire('all', {}, { db });
  assert.deepEqual(resumed.previous.pendingAssets, {
    mediaIds: ['media-1'],
    backupFileIds: ['backup-1']
  });
  await maintenance.fail(resumed.operationId, new Error('interrompida novamente'), {}, { db });
  const otherScope = await maintenance.acquire('conversationbackups', {}, { db });
  assert.equal(otherScope.resumed, false);
  assert.equal(otherScope.previous, null);
});
