const { z, paginationQuery } = require('./common.dto');

const collectionKey = z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/i);

const storageExportSchema = z.object({
  query: z.object({
    format: z.enum(['json', 'zip']).default('json'),
    collection: collectionKey.default('all')
  })
});

const storageClearSchema = z.object({
  body: z.object({
    collection: collectionKey,
    confirmation: z.string().min(8).max(200)
  }).strict()
});

const storageAuditSchema = z.object({
  query: paginationQuery.extend({
    action: z.enum(['export', 'clear']).optional(),
    scope: collectionKey.optional()
  })
});

module.exports = { storageExportSchema, storageClearSchema, storageAuditSchema };
