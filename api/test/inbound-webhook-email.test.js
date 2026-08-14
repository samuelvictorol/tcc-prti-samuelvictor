const test = require('node:test');
const assert = require('node:assert/strict');
const InboundEmailAlert = require('../src/models/inbound-email-alert.model');
const settingsManager = require('../src/managers/settings.manager');
const gmailManager = require('../src/managers/gmail.manager');
const logsManager = require('../src/managers/logs.manager');
const service = require('../src/services/inbound-webhook-email.service');
const { encrypt, decrypt } = require('../src/services/crypto.service');

function queryResult(value) {
  return { select: async () => value };
}

function install(context, options = {}) {
  service.stop();
  const originals = {
    create: InboundEmailAlert.create,
    updateOne: InboundEmailAlert.updateOne,
    updateMany: InboundEmailAlert.updateMany,
    findOneAndUpdate: InboundEmailAlert.findOneAndUpdate,
    getValue: settingsManager.getValue,
    channelConfigured: settingsManager.channelConfigured,
    send: gmailManager.send,
    log: logsManager.create
  };
  context.after(() => {
    service.stop();
    InboundEmailAlert.create = originals.create;
    InboundEmailAlert.updateOne = originals.updateOne;
    InboundEmailAlert.updateMany = originals.updateMany;
    InboundEmailAlert.findOneAndUpdate = originals.findOneAndUpdate;
    settingsManager.getValue = originals.getValue;
    settingsManager.channelConfigured = originals.channelConfigured;
    gmailManager.send = originals.send;
    logsManager.create = originals.log;
  });
  const state = { creates: [], updates: [], updateMany: [], claims: [], sends: [], logs: [] };
  settingsManager.getValue = async () => options.destination ?? 'central@example.test';
  settingsManager.channelConfigured = async () => options.gmailConfigured !== false;
  InboundEmailAlert.create = async (input) => {
    state.creates.push(input);
    if (options.duplicate) {
      const error = new Error('duplicate');
      error.code = 11000;
      throw error;
    }
    return { _id: '507f1f77bcf86cd799439099', ...input };
  };
  InboundEmailAlert.updateOne = async (...args) => { state.updates.push(args); return { modifiedCount: 1 }; };
  InboundEmailAlert.updateMany = async (...args) => { state.updateMany.push(args); return { modifiedCount: 0 }; };
  InboundEmailAlert.findOneAndUpdate = (...args) => {
    state.claims.push(args);
    return queryResult(options.claims?.shift() || null);
  };
  gmailManager.send = async (input) => {
    state.sends.push(input);
    if (options.sendErrors?.length) throw Object.assign(new Error('smtp'), { code: options.sendErrors.shift() });
    return { providerMessageId: 'mail-1' };
  };
  logsManager.create = async (input) => { state.logs.push(input); };
  return state;
}

function claimedAlert(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439099',
    channel: 'telegram',
    status: 'processing',
    attemptCount: 1,
    maxAttempts: 3,
    recipientEncrypted: encrypt('central@example.test'),
    subjectEncrypted: encrypt('[TELEGRAM] Ana: Ola'),
    textEncrypted: encrypt('Conteudo de teste'),
    htmlEncrypted: encrypt('<p>Conteudo de teste</p>'),
    ...overrides
  };
}

test('webhook persiste outbox criptografada antes do ACK sem aguardar SMTP', async (context) => {
  const state = install(context);
  const result = await service.notify({
    channel: 'telegram',
    externalId: '123',
    providerMessageId: 'msg-1',
    displayName: 'Ana <Admin>',
    message: 'Oi <script>alert(1)</script>\nTudo bem?'
  });

  assert.equal(result.queued, true);
  assert.equal(state.creates.length, 1);
  assert.equal(state.sends.length, 0);
  const persisted = state.creates[0];
  assert.equal(persisted.status, 'pending');
  assert.match(persisted.recipientEncrypted, /^enc:v1:/);
  assert.match(persisted.htmlEncrypted, /^enc:v1:/);
  assert.equal(decrypt(persisted.recipientEncrypted), 'central@example.test');
  assert.doesNotMatch(JSON.stringify(persisted), /central@example\.test|<script>|Tudo bem/);
  assert.match(decrypt(persisted.htmlEncrypted), /&lt;script&gt;/);
});

test('retry duplicado nao cria uma segunda tarefa', async (context) => {
  const state = install(context, { duplicate: true });
  const result = await service.notify({
    channel: 'whatsapp_cloud', externalId: '5511999999999', providerMessageId: 'wamid.1',
    displayName: 'Cliente', message: 'Ola'
  });
  assert.equal(result.duplicate, true);
  assert.equal(state.sends.length, 0);
});

test('worker recupera lease vencido e envia payload descriptografado', async (context) => {
  const options = { claims: [claimedAlert()] };
  const state = install(context, options);
  const now = new Date('2026-08-13T12:00:00.000Z');
  const result = await service.processNext(now);

  assert.equal(result.sent, true);
  assert.equal(state.sends.length, 1);
  assert.equal(state.sends[0].destination, 'central@example.test');
  assert.equal(state.sends[0].text, 'Conteudo de teste');
  assert.equal(state.sends[0].allowUnconsented, true);
  assert.equal(state.claims[0][0].$or[1].status, 'processing');
  assert.deepEqual(state.claims[0][0].$or[1].$or[0].leaseExpiresAt, { $lte: now });
  assert.equal(state.updates.at(-1)[1].$set.status, 'sent');
});

test('falha transitoria volta para pending com backoff e a terceira tentativa encerra', async (context) => {
  const options = {
    claims: [claimedAlert({ attemptCount: 1 }), claimedAlert({ attemptCount: 3 })],
    sendErrors: ['SMTP_TEMPORARY', 'SMTP_TEMPORARY']
  };
  const state = install(context, options);

  const retry = await service.processNext(new Date('2026-08-13T12:00:00.000Z'));
  assert.equal(retry.retry, true);
  assert.equal(state.updates[0][1].$set.status, 'pending');
  assert.ok(state.updates[0][1].$set.nextAttemptAt instanceof Date);
  assert.equal(state.updates[0][1].$unset.leaseExpiresAt, 1);

  const failed = await service.processNext(new Date('2026-08-13T12:10:00.000Z'));
  assert.equal(failed.failed, true);
  assert.equal(state.updates[1][1].$set.status, 'failed');
  assert.equal(state.logs.at(-1).action, 'webhook_alert.failed');
  assert.doesNotMatch(JSON.stringify(state.logs), /central@example\.test|Conteudo de teste/);
});

test('startup encerra lease esgotado e permite recuperar processing sem lease', async (context) => {
  const options = { claims: [] };
  const state = install(context, options);
  const now = new Date('2026-08-13T12:00:00.000Z');
  await service.recoverExhaustedLeases(now);

  assert.equal(state.updateMany.length, 1);
  assert.equal(state.updateMany[0][0].status, 'processing');
  assert.deepEqual(state.updateMany[0][0].attemptCount, { $gte: 3 });
  assert.equal(state.updateMany[0][1].$set.status, 'failed');
  assert.equal(state.updateMany[0][1].$set.errorCode, 'WORKER_LEASE_EXPIRED');

  await service.claimNext(now);
  const staleBranch = state.claims[0][0].$or[1];
  assert.equal(staleBranch.status, 'processing');
  assert.ok(staleBranch.$or.some((part) => part.leaseExpiresAt === null));
});

test('Gmail incompleto nao aceita destinatario nem persiste alerta', async (context) => {
  const state = install(context, { gmailConfigured: false });
  const skipped = await service.notify({
    channel: 'telegram', externalId: '1', providerMessageId: '3', displayName: 'X', message: 'Y'
  });
  assert.equal(skipped.reason, 'gmail_not_configured');
  assert.equal(state.creates.length, 0);
  assert.equal(state.logs.at(-1).action, 'webhook_alert.skipped');
});
