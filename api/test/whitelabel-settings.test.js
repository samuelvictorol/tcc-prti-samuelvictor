const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Setting = require('../src/models/setting.model');
const authManager = require('../src/managers/auth.manager');
const logsManager = require('../src/managers/logs.manager');
const settingsManager = require('../src/managers/settings.manager');
const { decrypt } = require('../src/services/crypto.service');
const { whitelabelUpdateSchema } = require('../src/dtos/settings.dto');
const { createApp } = require('../src/app');

function queryResult(value) {
  const query = {
    select() { return query; },
    async lean() { return value; }
  };
  return query;
}

test('whitelabel seco possui identidade Notify Flow e rodape Aito Softwares', async (context) => {
  const originalFindOne = Setting.findOne;
  context.after(() => { Setting.findOne = originalFindOne; });
  Setting.findOne = () => queryResult(null);

  const branding = await settingsManager.getWhitelabel();
  assert.deepEqual(branding, settingsManager.DEFAULT_WHITELABEL);
  assert.equal(branding.identity.name, 'Notify Flow');
  assert.deepEqual(branding.colors, {
    primary: '#35BCA4',
    secondary: '#82F8E6',
    accent: '#137D6C',
    background: '#F4FBF9'
  });
  assert.equal(branding.footer.text, 'Powered by @aitosoftwares');
  assert.equal(branding.links.website, 'https://aitosoftwares.com/');
  assert.equal(branding.links.instagram, 'https://www.instagram.com/aitosoftwares/');
});

test('atualizacao parcial preserva os defaults e persiste configuracao criptografada', async (context) => {
  const originals = { findOne: Setting.findOne, updateOne: Setting.updateOne };
  context.after(() => {
    Setting.findOne = originals.findOne;
    Setting.updateOne = originals.updateOne;
  });
  let persisted;
  let stored = null;
  Setting.findOne = () => queryResult(stored);
  Setting.updateOne = async (filter, update, options) => {
    persisted = { filter, update, options };
    stored = { valueEncrypted: update.$set.valueEncrypted };
    return { acknowledged: true };
  };

  const branding = await settingsManager.setWhitelabel({
    identity: { name: 'Portal Alpha', logoUrl: 'https://cdn.example.com/logo.svg' },
    colors: { primary: '#1122aa' }
  }, '507f1f77bcf86cd799439011');

  assert.equal(branding.identity.name, 'Portal Alpha');
  assert.equal(branding.identity.title, 'Notify Flow');
  assert.equal(branding.identity.logoUrl, 'https://cdn.example.com/logo.svg');
  assert.equal(branding.colors.primary, '#1122AA');
  assert.equal(branding.colors.background, '#F4FBF9');
  assert.deepEqual(persisted.filter, { key: settingsManager.WHITELABEL_KEY });
  assert.equal(persisted.options.upsert, true);
  assert.equal(persisted.update.$set.sensitive, false);
  assert.equal(persisted.update.$set.updatedBy, '507f1f77bcf86cd799439011');
  assert.deepEqual(JSON.parse(decrypt(persisted.update.$set.valueEncrypted)), branding);
});

test('DTO whitelabel aceita somente cores hexadecimais e URLs HTTPS publicas', () => {
  const valid = whitelabelUpdateSchema.safeParse({
    body: {
      branding: {
        identity: { name: 'Minha empresa', logoUrl: 'https://cdn.example.com/logo.png' },
        colors: { primary: '#abcdef' },
        links: { website: 'https://example.com' }
      }
    }
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.body.branding.colors.primary, '#ABCDEF');
  assert.equal(valid.data.body.branding.links.website, 'https://example.com/');

  for (const body of [
    { branding: { colors: { primary: 'red' } } },
    { branding: { identity: { logoUrl: 'http://example.com/logo.png' } } },
    { branding: { links: { website: 'https://localhost/admin' } } },
    { branding: {} }
  ]) {
    assert.equal(whitelabelUpdateSchema.safeParse({ body }).success, false);
  }
});

test('leitura whitelabel e publica, mas escrita continua autenticada', async (context) => {
  const originals = {
    findOne: Setting.findOne,
    updateOne: Setting.updateOne,
    auth: authManager.authenticateAccess,
    log: logsManager.create
  };
  context.after(() => {
    Setting.findOne = originals.findOne;
    Setting.updateOne = originals.updateOne;
    authManager.authenticateAccess = originals.auth;
    logsManager.create = originals.log;
  });
  let stored = null;
  Setting.findOne = () => queryResult(stored);
  Setting.updateOne = async (_filter, update) => {
    stored = { valueEncrypted: update.$set.valueEncrypted };
    return { acknowledged: true };
  };

  const app = createApp();
  const publicResponse = await request(app).get('/api/settings/whitelabel');
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.body.data.branding.identity.name, 'Notify Flow');

  const unauthorized = await request(app)
    .put('/api/settings/whitelabel')
    .send({ branding: { identity: { name: 'Outro nome' } } });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.body.error.code, 'AUTH_REQUIRED');

  authManager.authenticateAccess = async () => ({ id: '507f1f77bcf86cd799439011' });
  logsManager.create = async (input) => input;
  const updated = await request(app)
    .put('/api/settings/whitelabel')
    .set('authorization', 'Bearer admin-token')
    .send({ branding: { identity: { name: 'Outro nome' } } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.branding.identity.name, 'Outro nome');
  assert.equal(updated.body.data.branding.footer.text, 'Powered by @aitosoftwares');
});
