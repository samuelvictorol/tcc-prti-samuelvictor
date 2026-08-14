const { Queue, Worker } = require('bullmq');
const { randomUUID } = require('node:crypto');
const { env } = require('../config/env');
const ApiError = require('../utils/api-error');
const storageMaintenance = require('./storage-maintenance.service');

let queue;
let worker;
let inlineProcessor;
let recoveryProcessor;
let recoveryTimer;
let recoverySweepInFlight = false;
let maintenanceActive = false;
const inlineHandles = new Set();
const inlineTasks = new Set();

const RECOVERY_SWEEP_INTERVAL_MS = 60_000;

function connectionOptions(options = {}) {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    // Workers use a blocking connection and must wait for Redis. Producers
    // should fail quickly so the durable Mongo recovery marker can take over.
    maxRetriesPerRequest: options.blocking ? null : 1,
    connectTimeout: 5_000,
    retryStrategy: env.redisRequired ? (times) => Math.min(times * 100, 3_000) : () => null
  };
}

function registerNotificationProcessor(processor, recoverer) {
  inlineProcessor = processor;
  recoveryProcessor = recoverer;
}

function workerPayload(job, lockToken) {
  return {
    ...job.data,
    queueContext: {
      jobId: String(job.id || job.data.jobId || job.data.notificationId),
      lockToken: String(lockToken || job.token || randomUUID()),
      attemptsStarted: Number(job.attemptsStarted || 1),
      attemptsMade: Number(job.attemptsMade || 0),
      maxAttempts: Math.max(1, Number(job.opts?.attempts || 1)),
      stalledCounter: Number(job.stalledCounter || 0)
    }
  };
}

function startRecoverySweep() {
  if (!recoveryProcessor || recoveryTimer) return;
  recoveryTimer = setInterval(async () => {
    if (recoverySweepInFlight) return;
    recoverySweepInFlight = true;
    try {
      if (maintenanceActive) return;
      await storageMaintenance.assertWritesAllowed();
      await recoveryProcessor();
    } catch (error) {
      console.error('[notification recovery]', error.message);
    } finally {
      recoverySweepInFlight = false;
    }
  }, RECOVERY_SWEEP_INTERVAL_MS);
  recoveryTimer.unref?.();
}

async function initializeQueue() {
  try {
    queue = new Queue('notifications', { connection: connectionOptions() });
    await queue.waitUntilReady();
    if (inlineProcessor) {
      worker = new Worker('notifications', (job, lockToken) => inlineProcessor(workerPayload(job, lockToken)), {
        connection: connectionOptions({ blocking: true }),
        concurrency: 5,
        maxStalledCount: 3
      });
      worker.on('error', (error) => console.error('[queue worker]', error.message));
    }
  } catch (error) {
    queue = undefined;
    if (env.redisRequired) throw error;
    console.warn('[queue] indisponivel; processando localmente:', error.message);
  }
  startRecoverySweep();
}

async function enqueueNotification(data) {
  if (maintenanceActive) {
    throw new ApiError(503, 'Fila pausada para manutencao', null, 'STORAGE_MAINTENANCE_ACTIVE');
  }
  await storageMaintenance.assertWritesAllowed();
  const delay = Math.max(0, Math.min(Number(data.delayMs) || 0, 24 * 60 * 60 * 1000));
  const attempts = Math.max(1, Math.min(Number(data.attempts) || 4, 10));
  const payload = { ...data };
  delete payload.delayMs;
  delete payload.attempts;
  if (queue) {
    const job = await queue.add('dispatch', payload, {
      attempts,
      backoff: { type: 'exponential', delay: 2_000 },
      delay,
      removeOnComplete: 500,
      removeOnFail: 1000,
      jobId: data.jobId || data.notificationId
    });
    return { mode: 'queue', jobId: job.id };
  }
  if (!inlineProcessor) throw new Error('Processador de notificacoes nao registrado');
  const process = () => {
    inlineHandles.delete(handle);
    if (maintenanceActive) return;
    const task = Promise.resolve(inlineProcessor({
      ...payload,
      queueContext: {
        jobId: String(data.jobId || data.notificationId),
        lockToken: randomUUID(),
        attemptsStarted: 1,
        attemptsMade: 0,
        maxAttempts: attempts,
        stalledCounter: 0
      }
    })).catch((error) => console.error('[inline notification]', error));
    inlineTasks.add(task);
    task.finally(() => inlineTasks.delete(task));
  };
  const handle = delay ? setTimeout(process, delay) : setImmediate(process);
  handle.unref?.();
  inlineHandles.add(handle);
  return { mode: 'inline', jobId: payload.notificationId, delay };
}

async function beginStorageMaintenance() {
  maintenanceActive = true;
  try {
    for (const handle of inlineHandles) {
      clearTimeout(handle);
      clearImmediate(handle);
    }
    const cancelledInline = inlineHandles.size;
    inlineHandles.clear();
    if (queue) await queue.pause();
    if (worker) await worker.pause(false);
    if (inlineTasks.size) await Promise.allSettled([...inlineTasks]);
    let cancelledQueued = 0;
    if (queue) {
      const counts = await queue.getJobCounts('wait', 'delayed', 'prioritized', 'paused', 'waiting-children');
      cancelledQueued = Object.values(counts).reduce((total, count) => total + Number(count || 0), 0);
      await queue.drain(true);
      for (const state of ['completed', 'failed']) await queue.clean(0, 10_000, state);
    }
    return { cancelledQueued, cancelledInline, activeDrained: true };
  } catch (error) {
    maintenanceActive = false;
    throw error;
  }
}

async function endStorageMaintenance() {
  try {
    if (queue) await queue.resume();
    if (worker) await worker.resume();
  } finally {
    maintenanceActive = false;
  }
}

async function closeQueue() {
  if (recoveryTimer) clearInterval(recoveryTimer);
  recoveryTimer = undefined;
  recoverySweepInFlight = false;
  await worker?.close();
  await queue?.close();
  worker = undefined;
  queue = undefined;
}

module.exports = {
  registerNotificationProcessor,
  initializeQueue,
  enqueueNotification,
  beginStorageMaintenance,
  endStorageMaintenance,
  closeQueue,
  workerPayload,
  connectionOptions
};
