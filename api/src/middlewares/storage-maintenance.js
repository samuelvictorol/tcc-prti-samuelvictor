const { env } = require('../config/env');
const maintenance = require('../services/storage-maintenance.service');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isClearRequest(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return req.method === 'POST' && path === `${env.apiPrefix}/system/storage-clear`;
}

async function storageMaintenanceGuard(req, _res, next) {
  if (!MUTATING_METHODS.has(req.method) || isClearRequest(req)) return next();
  // Unit/integration apps are often created without opening Mongo. Their own
  // route guards remain authoritative; maintenance only exists with a live DB.
  if (!require('mongoose').connection.db) return next();
  try {
    await maintenance.assertWritesAllowed();
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { storageMaintenanceGuard, isClearRequest, MUTATING_METHODS };
