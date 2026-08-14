const mongoose = require('mongoose');
const { getRedis } = require('../services/redis.service');
const { env } = require('../config/env');
const ApiError = require('../utils/api-error');

async function health() {
  const mongodbUp = mongoose.connection.readyState === 1;
  const redisUp = Boolean(getRedis());
  const ready = mongodbUp && (!env.redisRequired || redisUp);
  return {
    status: ready ? 'ok' : 'degraded',
    ready,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    dependencies: {
      mongodb: mongodbUp ? 'up' : 'down',
      redis: redisUp ? 'up' : env.redisRequired ? 'down' : 'optional-down'
    }
  };
}

function finiteBytes(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function collectionUsage(name, stats = {}) {
  const dataBytes = finiteBytes(stats.size);
  const storageBytes = finiteBytes(stats.storageSize);
  const indexBytes = finiteBytes(stats.totalIndexSize);
  return {
    name,
    count: Math.max(0, Math.trunc(Number(stats.count) || 0)),
    dataBytes,
    storageBytes,
    indexBytes,
    totalBytes: storageBytes + indexBytes
  };
}

async function readCollectionStats(db, name) {
  const rows = await db.collection(name).aggregate([
    { $collStats: { storageStats: { scale: 1 } } },
    {
      $project: {
        _id: 0,
        count: '$storageStats.count',
        size: '$storageStats.size',
        storageSize: '$storageStats.storageSize',
        totalIndexSize: '$storageStats.totalIndexSize'
      }
    }
  ]).toArray();
  const totals = rows.reduce((sum, row) => ({
    count: sum.count + (Number(row?.count) || 0),
    size: sum.size + (Number(row?.size) || 0),
    storageSize: sum.storageSize + (Number(row?.storageSize) || 0),
    totalIndexSize: sum.totalIndexSize + (Number(row?.totalIndexSize) || 0)
  }), { count: 0, size: 0, storageSize: 0, totalIndexSize: 0 });
  return collectionUsage(name, totals);
}

async function storageUsage(options = {}) {
  const db = options.db || mongoose.connection.db;
  const connected = options.db || mongoose.connection.readyState === 1;
  if (!connected || !db) {
    throw new ApiError(503, 'MongoDB indisponivel para calcular o armazenamento', null, 'MONGODB_UNAVAILABLE');
  }

  const [databaseStats, descriptors] = await Promise.all([
    db.command({ dbStats: 1, scale: 1 }),
    db.listCollections({}, { nameOnly: true }).toArray()
  ]);
  const names = descriptors
    .map((item) => String(item.name || '').trim())
    .filter((name) => name && !name.startsWith('system.'));
  const collections = (await Promise.all(names.map(async (name) => {
    try {
      return await readCollectionStats(db, name);
    } catch (_error) {
      return collectionUsage(name);
    }
  }))).sort((left, right) => right.totalBytes - left.totalBytes || left.name.localeCompare(right.name));

  const dataBytes = finiteBytes(databaseStats.dataSize);
  const storageBytes = finiteBytes(databaseStats.storageSize);
  const indexBytes = finiteBytes(databaseStats.indexSize);
  const computedTotal = storageBytes + indexBytes;
  return {
    database: String(db.databaseName || databaseStats.db || 'mongodb'),
    collectionCount: collections.length,
    objects: Math.max(0, Math.trunc(Number(databaseStats.objects) || collections.reduce(
      (total, collection) => total + collection.count,
      0
    ))),
    dataBytes,
    storageBytes,
    indexBytes,
    totalBytes: finiteBytes(databaseStats.totalSize) || computedTotal,
    collections,
    measuredAt: new Date().toISOString()
  };
}

module.exports = { health, storageUsage, collectionUsage, finiteBytes };
