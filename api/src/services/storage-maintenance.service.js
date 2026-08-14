const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const ApiError = require('../utils/api-error');

const COLLECTION = 'storageoperations';
const LOCK_ID = 'storage-clear-lock';
const LOCK_TTL_MS = 60 * 60 * 1000;

function dbOrThrow(options = {}) {
  const db = options.db || mongoose.connection.db;
  if (!db || (!options.db && mongoose.connection.readyState !== 1)) {
    throw new ApiError(503, 'MongoDB indisponivel', null, 'MONGODB_UNAVAILABLE');
  }
  return db;
}

function isActive(operation, now = new Date()) {
  return operation?.status === 'running'
    && operation.lockedUntil
    && new Date(operation.lockedUntil) > now;
}

async function current(options = {}) {
  const db = dbOrThrow(options);
  return db.collection(COLLECTION).findOne({ _id: LOCK_ID });
}

async function assertWritesAllowed(options = {}) {
  if (!options.db && !mongoose.connection.db) return null;
  const operation = await current(options);
  if (!isActive(operation)) return null;
  throw new ApiError(
    503,
    'Armazenamento em manutencao; tente novamente em instantes',
    {
      operationId: operation.operationId,
      scope: operation.scope,
      startedAt: operation.startedAt,
      currentStep: operation.currentStep || null
    },
    'STORAGE_MAINTENANCE_ACTIVE'
  );
}

async function acquire(scope, context = {}, options = {}) {
  const db = dbOrThrow(options);
  const collection = db.collection(COLLECTION);
  await collection.updateOne(
    { _id: LOCK_ID },
    { $setOnInsert: { revision: 0, status: 'idle', createdAt: new Date() } },
    { upsert: true }
  );
  const existing = await collection.findOne({ _id: LOCK_ID });
  const now = new Date();
  if (isActive(existing, now)) {
    throw new ApiError(
      409,
      'Ja existe uma limpeza de armazenamento em andamento',
      { operationId: existing.operationId, scope: existing.scope, startedAt: existing.startedAt },
      'STORAGE_CLEAR_LOCKED'
    );
  }
  const operationId = randomUUID();
  const canResume = (existing?.status === 'partial' || existing?.status === 'failed')
    && existing?.scope === scope;
  const previous = canResume
    ? {
      operationId: existing.operationId,
      status: existing.status,
      completedSteps: existing.completedSteps || [],
      pendingAssets: existing.pendingAssets || { mediaIds: [], backupFileIds: [] }
    }
    : null;
  const result = await collection.updateOne(
    { _id: LOCK_ID, revision: Number(existing?.revision || 0) },
    {
      $set: {
        operationId,
        scope,
        status: 'running',
        startedAt: now,
        updatedAt: now,
        heartbeatAt: now,
        lockedUntil: new Date(now.getTime() + LOCK_TTL_MS),
        actor: context.actor || null,
        requestId: context.requestId || null,
        currentStep: 'preflight',
        completedSteps: [],
        counts: {},
        preflight: null,
        previous,
        pendingAssets: previous?.pendingAssets || { mediaIds: [], backupFileIds: [] },
        error: null,
        completedAt: null
      },
      $inc: { revision: 1 }
    }
  );
  if (Number(result.modifiedCount || 0) !== 1) {
    throw new ApiError(409, 'Outra limpeza adquiriu o bloqueio', null, 'STORAGE_CLEAR_LOCKED');
  }
  return { operationId, resumed: Boolean(previous), previous };
}

async function heartbeat(operationId, patch = {}, options = {}) {
  const db = dbOrThrow(options);
  const now = new Date();
  const result = await db.collection(COLLECTION).updateOne(
    { _id: LOCK_ID, operationId, status: 'running' },
    {
      $set: {
        ...patch,
        heartbeatAt: now,
        updatedAt: now,
        lockedUntil: new Date(now.getTime() + LOCK_TTL_MS)
      }
    }
  );
  if (Number(result.matchedCount || 0) !== 1) {
    throw new ApiError(409, 'O bloqueio da limpeza foi perdido', { operationId }, 'STORAGE_CLEAR_LOCK_LOST');
  }
}

async function complete(operationId, result, options = {}) {
  const db = dbOrThrow(options);
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: LOCK_ID, operationId },
    {
      $set: {
        status: 'completed',
        currentStep: null,
        result,
        completedAt: now,
        heartbeatAt: now,
        updatedAt: now,
        lockedUntil: now
      }
    }
  );
}

async function fail(operationId, error, progress = {}, options = {}) {
  const db = dbOrThrow(options);
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: LOCK_ID, operationId },
    {
      $set: {
        status: 'partial',
        currentStep: progress.currentStep || null,
        completedSteps: progress.completedSteps || [],
        counts: progress.counts || {},
        error: {
          code: error?.code || 'STORAGE_CLEAR_FAILED',
          message: String(error?.message || 'Falha na limpeza').slice(0, 500)
        },
        completedAt: now,
        heartbeatAt: now,
        updatedAt: now,
        lockedUntil: now
      }
    }
  );
}

module.exports = {
  COLLECTION,
  LOCK_ID,
  LOCK_TTL_MS,
  isActive,
  current,
  assertWritesAllowed,
  acquire,
  heartbeat,
  complete,
  fail
};
