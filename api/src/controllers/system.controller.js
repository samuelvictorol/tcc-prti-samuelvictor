const systemManager = require('../managers/system.manager');
const storageManager = require('../managers/system-storage.manager');
const logsManager = require('../managers/logs.manager');

async function health(_req, res) {
  const data = await systemManager.health();
  res.status(data.status === 'ok' ? 200 : 503).json({ success: data.status === 'ok', data });
}

async function storageUsage(_req, res) {
  const data = await systemManager.storageUsage();
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json({ success: true, data });
}

async function storageCollections(_req, res) {
  const data = await storageManager.collectionMetadata();
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json({ success: true, data });
}

function auditInput(req, action, outcome, context = {}, level = 'info') {
  return {
    level,
    channel: 'system',
    action: `storage.${action}.${outcome}`,
    message: `${action === 'export' ? 'Exportacao' : 'Limpeza'} de armazenamento: ${outcome}`,
    actor: req.admin.id,
    requestId: req.id,
    retentionUntil: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
    context: { scope: context.scope, format: context.format, ...context }
  };
}

function waitForResponseFinish(res, label) {
  if (res.writableFinished) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      res.off('finish', onFinish);
      res.off('close', onClose);
      res.off('error', onError);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onFinish = () => settle(resolve);
    const onClose = () => settle(reject, new Error(`Cliente encerrou a ${label} antes da conclusao`));
    const onError = (error) => settle(reject, error);
    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);
  });
}

async function storageExport(req, res, next) {
  const { format, collection: scope } = req.validated.query;
  const includeMedia = format === 'zip' && (scope === 'all' || scope === 'templates');
  await logsManager.create(auditInput(req, 'export', 'started', { scope, format }));
  try {
    const plan = await storageManager.exportPlan(undefined, scope, includeMedia);
    const filename = `notify-flow-${scope}-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    res.set({
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': format === 'zip' ? 'application/zip' : 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    let data;
    if (format === 'zip') {
      data = await storageManager.streamZip(res, scope, { plan });
    } else {
      data = await storageManager.writeJsonExport(res, scope, { plan });
      res.end();
      await waitForResponseFinish(res, 'exportacao JSON');
    }
    await logsManager.create(auditInput(req, 'export', 'completed', { scope, format, ...data }));
  } catch (error) {
    await logsManager.create(auditInput(req, 'export', 'failed', {
      scope, format, errorCode: error.code || 'EXPORT_FAILED'
    }, 'error')).catch(() => {});
    if (res.headersSent) return res.destroy(error);
    return next(error);
  }
  return undefined;
}

async function storageClear(req, res) {
  const { collection: scope, confirmation } = req.validated.body;
  await logsManager.create(auditInput(req, 'clear', 'started', { scope }));
  try {
    const data = await storageManager.clearStorage(scope, confirmation, {
      actor: req.admin.id,
      requestId: req.id
    });
    await logsManager.create(auditInput(req, 'clear', 'completed', { scope, ...data }));
    res.json({ success: true, data });
  } catch (error) {
    await logsManager.create(auditInput(req, 'clear', error.storageProgress ? 'partial' : 'failed', {
      scope,
      errorCode: error.code || 'CLEAR_FAILED',
      operationId: error.storageProgress?.operationId,
      currentStep: error.storageProgress?.currentStep,
      completedSteps: error.storageProgress?.completedSteps,
      counts: error.storageProgress?.counts
    }, 'error')).catch(() => {});
    throw error;
  }
}

async function storageAudit(req, res) {
  const data = await storageManager.auditList(req.validated.query);
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json({ success: true, data });
}

module.exports = { health, storageUsage, storageCollections, storageExport, storageClear, storageAudit };
