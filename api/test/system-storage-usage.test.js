const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const authManager = require('../src/managers/auth.manager');
const systemManager = require('../src/managers/system.manager');
const { createApp } = require('../src/app');

function fakeDatabase() {
  const stats = {
    contacts: [
      { count: 7, size: 600, storageSize: 700, totalIndexSize: 180 },
      { count: 5, size: 400, storageSize: 500, totalIndexSize: 120 }
    ],
    templates: [
      { count: 3, size: 600, storageSize: 800, totalIndexSize: 200 }
    ]
  };
  return {
    databaseName: 'notify_app',
    async command(command) {
      assert.deepEqual(command, { dbStats: 1, scale: 1 });
      return {
        db: 'notify_app',
        objects: 15,
        dataSize: 1_600,
        storageSize: 2_000,
        indexSize: 500,
        totalSize: 2_500
      };
    },
    listCollections() {
      return {
        async toArray() {
          return [{ name: 'templates' }, { name: 'system.views' }, { name: 'contacts' }];
        }
      };
    },
    collection(name) {
      return {
        aggregate() {
          return { async toArray() { return stats[name]; } };
        }
      };
    }
  };
}

test('uso do Mongo totaliza banco, soma shards e ordena collections pelo consumo', async () => {
  const usage = await systemManager.storageUsage({ db: fakeDatabase() });
  assert.equal(usage.database, 'notify_app');
  assert.equal(usage.collectionCount, 2);
  assert.equal(usage.objects, 15);
  assert.equal(usage.totalBytes, 2_500);
  assert.equal(usage.dataBytes, 1_600);
  assert.deepEqual(usage.collections.map(({ name }) => name), ['contacts', 'templates']);
  assert.deepEqual(usage.collections[0], {
    name: 'contacts',
    count: 12,
    dataBytes: 1_000,
    storageBytes: 1_200,
    indexBytes: 300,
    totalBytes: 1_500
  });
  assert.match(usage.measuredAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('endpoint de consumo do Mongo exige autenticacao', async (context) => {
  const originals = {
    auth: authManager.authenticateAccess,
    storageUsage: systemManager.storageUsage
  };
  context.after(() => {
    authManager.authenticateAccess = originals.auth;
    systemManager.storageUsage = originals.storageUsage;
  });
  const app = createApp();
  const unauthorized = await request(app).get('/api/system/storage-usage');
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.body.error.code, 'AUTH_REQUIRED');

  authManager.authenticateAccess = async () => ({ id: '507f1f77bcf86cd799439011' });
  systemManager.storageUsage = async () => ({ database: 'notify_app', totalBytes: 42, collections: [] });
  const response = await request(app)
    .get('/api/system/storage-usage')
    .set('authorization', 'Bearer admin-token');
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(response.body.data.totalBytes, 42);
});
