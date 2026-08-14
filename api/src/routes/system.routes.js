const express = require('express');
const controller = require('../controllers/system.controller');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middlewares/auth');
const { env } = require('../config/env');
const validate = require('../middlewares/validate');
const { storageExportSchema, storageClearSchema, storageAuditSchema } = require('../dtos/system-storage.dto');

const rootRouter = express.Router();
rootRouter.get('/', asyncHandler(controller.health));
const apiRouter = express.Router();
apiRouter.get('/', asyncHandler(controller.health));
const systemRouter = express.Router();
systemRouter.use(requireAuth);
systemRouter.get('/storage-usage', asyncHandler(controller.storageUsage));
systemRouter.get('/storage-collections', asyncHandler(controller.storageCollections));
systemRouter.get('/storage-export', validate(storageExportSchema), asyncHandler(controller.storageExport));
systemRouter.post('/storage-clear', validate(storageClearSchema), asyncHandler(controller.storageClear));
systemRouter.get('/storage-audit', validate(storageAuditSchema), asyncHandler(controller.storageAudit));

module.exports = [
  { basePath: '/health', router: rootRouter },
  { basePath: env.apiPrefix + '/health', router: apiRouter },
  { basePath: env.apiPrefix + '/system', router: systemRouter }
];
