const crypto = require('node:crypto');
const InboundEmailAlert = require('../models/inbound-email-alert.model');
const settingsManager = require('../managers/settings.manager');
const gmailManager = require('../managers/gmail.manager');
const logsManager = require('../managers/logs.manager');
const { encrypt, decrypt, searchHash } = require('./crypto.service');

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const IDLE_POLL_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = Object.freeze([60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000]);
const CHANNEL_LABELS = Object.freeze({
  telegram: 'TELEGRAM',
  whatsapp_cloud: 'WHATSAPP'
});

let timer = null;
let drainPromise = null;
let started = false;

function plainText(value, maximum, fallback = '') {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\t', ' ')
    .split('')
    .filter((character) => {
      const code = character.codePointAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, maximum);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function emailContent({ channel, displayName, message }) {
  const label = CHANNEL_LABELS[channel] || 'CANAL';
  const name = plainText(displayName, 60, 'Contato');
  const body = plainText(message, 4_000, '[Mensagem sem texto]');
  const subjectExcerpt = plainText(body, 90, '[Mensagem sem texto]');
  const subject = `[${label}] ${name}: ${subjectExcerpt}`.slice(0, 180);
  return {
    subject,
    text: [
      `Nova mensagem recebida pelo ${label}.`,
      '',
      `Contato: ${name}`,
      `Mensagem: ${body}`,
      '',
      'Abra o Notify Flow para consultar a conversa e responder pelo canal correspondente.'
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,sans-serif;color:#173c36;line-height:1.5">',
      `<h2 style="margin:0 0 16px">Nova mensagem no ${escapeHtml(label)}</h2>`,
      `<p><strong>Contato:</strong> ${escapeHtml(name)}</p>`,
      `<div style="padding:16px;border-radius:12px;background:#f1faf8;white-space:pre-wrap">${escapeHtml(body)}</div>`,
      '<p style="color:#58716d">Abra o Notify Flow para consultar a conversa e responder pelo canal correspondente.</p>',
      '</div>'
    ].join('')
  };
}

function eventKey(input) {
  return [input.channel, input.externalId, input.providerMessageId]
    .map((part) => String(part || ''))
    .join(':');
}

async function reserve(input, destination) {
  if (!input.providerMessageId || !input.externalId) {
    return { queued: false, reason: 'missing_event_identity' };
  }
  const content = emailContent(input);
  try {
    const alert = await InboundEmailAlert.create({
      eventKeyHash: searchHash(eventKey(input)),
      providerMessageIdHash: searchHash(String(input.providerMessageId)),
      channel: input.channel,
      status: 'pending',
      recipientEncrypted: encrypt(destination),
      subjectEncrypted: encrypt(content.subject),
      textEncrypted: encrypt(content.text),
      htmlEncrypted: encrypt(content.html),
      attemptCount: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
      expiresAt: new Date(Date.now() + RETENTION_MS)
    });
    return { queued: true, alertId: String(alert._id) };
  } catch (error) {
    if (error?.code === 11000) return { queued: false, duplicate: true, reason: 'duplicate' };
    throw error;
  }
}

function dueFilter(now) {
  return {
    $or: [
      { status: 'pending', attemptCount: { $lt: MAX_ATTEMPTS }, nextAttemptAt: { $lte: now } },
      {
        status: 'processing',
        attemptCount: { $lt: MAX_ATTEMPTS },
        $or: [
          { leaseExpiresAt: { $lte: now } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $exists: false } }
        ]
      }
    ]
  };
}

async function recoverExhaustedLeases(now = new Date()) {
  return InboundEmailAlert.updateMany({
    status: 'processing',
    attemptCount: { $gte: MAX_ATTEMPTS },
    $or: [
      { leaseExpiresAt: { $lte: now } },
      { leaseExpiresAt: null },
      { leaseExpiresAt: { $exists: false } }
    ]
  }, {
    $set: {
      status: 'failed',
      errorCode: 'WORKER_LEASE_EXPIRED',
      completedAt: now
    },
    $unset: { leaseTokenHash: 1, leaseExpiresAt: 1 }
  });
}

async function claimNext(now = new Date()) {
  const leaseToken = crypto.randomBytes(32).toString('base64url');
  const leaseTokenHash = searchHash(leaseToken);
  const alert = await InboundEmailAlert.findOneAndUpdate(
    dueFilter(now),
    {
      $set: {
        status: 'processing',
        leaseTokenHash,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS)
      },
      $inc: { attemptCount: 1 }
    },
    {
      sort: { nextAttemptAt: 1, createdAt: 1 },
      new: true
    }
  ).select('+recipientEncrypted +subjectEncrypted +textEncrypted +htmlEncrypted +leaseTokenHash');
  return alert ? { alert, leaseTokenHash } : null;
}

function retryDelay(attemptCount) {
  return BACKOFF_MS[Math.min(Math.max(Number(attemptCount) - 1, 0), BACKOFF_MS.length - 1)];
}

async function completeClaim(claim, result, now = new Date()) {
  const { alert, leaseTokenHash } = claim;
  const selector = { _id: alert._id, status: 'processing', leaseTokenHash };
  if (result.sent) {
    await InboundEmailAlert.updateOne(selector, {
      $set: { status: 'sent', completedAt: now },
      $unset: { leaseTokenHash: 1, leaseExpiresAt: 1, errorCode: 1 }
    });
    return { sent: true };
  }
  const errorCode = plainText(result.errorCode || 'EMAIL_SEND_FAILED', 100);
  if (Number(alert.attemptCount) >= Number(alert.maxAttempts || MAX_ATTEMPTS)) {
    await InboundEmailAlert.updateOne(selector, {
      $set: { status: 'failed', errorCode, completedAt: now },
      $unset: { leaseTokenHash: 1, leaseExpiresAt: 1 }
    });
    return { sent: false, failed: true };
  }
  await InboundEmailAlert.updateOne(selector, {
    $set: {
      status: 'pending',
      errorCode,
      nextAttemptAt: new Date(now.getTime() + retryDelay(alert.attemptCount))
    },
    $unset: { leaseTokenHash: 1, leaseExpiresAt: 1 }
  });
  return { sent: false, retry: true };
}

async function processNext(now = new Date()) {
  const claim = await claimNext(now);
  if (!claim) return { processed: false };
  try {
    await gmailManager.send({
      destination: decrypt(claim.alert.recipientEncrypted),
      subject: decrypt(claim.alert.subjectEncrypted),
      text: decrypt(claim.alert.textEncrypted),
      html: decrypt(claim.alert.htmlEncrypted),
      allowUnconsented: true,
      useCase: 'inbound_webhook_alert'
    });
    await completeClaim(claim, { sent: true });
    return { processed: true, sent: true };
  } catch (error) {
    const outcome = await completeClaim(claim, {
      sent: false,
      errorCode: error.code || error.name || 'EMAIL_SEND_FAILED'
    });
    await logsManager.create({
      level: 'warn',
      channel: 'email',
      action: outcome.failed ? 'webhook_alert.failed' : 'webhook_alert.retry_scheduled',
      message: outcome.failed
        ? 'O aviso de nova mensagem por email esgotou as tentativas de entrega'
        : 'O aviso de nova mensagem por email sera tentado novamente',
      context: {
        sourceChannel: claim.alert.channel,
        attempt: claim.alert.attemptCount,
        errorCode: plainText(error.code || error.name || 'EMAIL_SEND_FAILED', 100)
      }
    }).catch(() => undefined);
    return { processed: true, ...outcome };
  }
}

async function drain({ maximum = 25 } = {}) {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    await recoverExhaustedLeases();
    let processed = 0;
    while (processed < maximum) {
      const result = await processNext();
      if (!result.processed) break;
      processed += 1;
    }
    return { processed };
  })().finally(() => { drainPromise = null; });
  return drainPromise;
}

function armTimer(delay = IDLE_POLL_MS) {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      await drain();
    } catch (error) {
      await logsManager.create({
        level: 'warn', channel: 'email', action: 'webhook_alert.worker_failed',
        message: 'O processador de avisos por email sera reiniciado automaticamente',
        context: { errorCode: plainText(error.code || error.name || 'OUTBOX_WORKER_FAILED', 100) }
      }).catch(() => undefined);
    } finally {
      armTimer(IDLE_POLL_MS);
    }
  }, Math.max(0, delay));
  timer.unref?.();
}

function scheduleDrain() {
  if (!started) return;
  armTimer(0);
}

function start() {
  if (started) return;
  started = true;
  // A primeira drenagem tambem recupera registros processing cujo lease venceu.
  armTimer(0);
}

function stop() {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

async function notify(input) {
  const destination = await settingsManager.getValue('GMAIL_WEBHOOK_NOTIFICATION_EMAIL');
  if (!destination) return { queued: false, skipped: true, reason: 'not_configured' };
  if (!await settingsManager.channelConfigured('email')) {
    await logsManager.create({
      level: 'warn', channel: 'email', action: 'webhook_alert.skipped',
      message: 'Aviso de nova mensagem ignorado porque o Gmail nao esta configurado',
      context: { sourceChannel: input.channel }
    }).catch(() => undefined);
    return { queued: false, skipped: true, reason: 'gmail_not_configured' };
  }
  const reservation = await reserve(input, destination);
  if (reservation.queued) scheduleDrain();
  return reservation;
}

module.exports = {
  notify,
  reserve,
  claimNext,
  processNext,
  completeClaim,
  recoverExhaustedLeases,
  drain,
  start,
  stop,
  emailContent,
  plainText,
  escapeHtml,
  retryDelay,
  constants: { RETENTION_MS, LEASE_MS, MAX_ATTEMPTS, IDLE_POLL_MS }
};
