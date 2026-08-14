const mongoose = require('mongoose');

const inboundEmailAlertSchema = new mongoose.Schema({
  eventKeyHash: { type: String, required: true, unique: true, index: true },
  channel: { type: String, enum: ['telegram', 'whatsapp_cloud'], required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending', index: true },
  providerMessageIdHash: { type: String, index: true },
  recipientEncrypted: { type: String, required: true, select: false },
  subjectEncrypted: { type: String, required: true, select: false },
  textEncrypted: { type: String, required: true, select: false },
  htmlEncrypted: { type: String, required: true, select: false },
  attemptCount: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 3, min: 1, max: 10 },
  nextAttemptAt: { type: Date, required: true, default: Date.now, index: true },
  leaseTokenHash: { type: String, select: false },
  leaseExpiresAt: { type: Date, index: true },
  errorCode: { type: String },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });

inboundEmailAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inboundEmailAlertSchema.index({ status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 });

module.exports = mongoose.models.InboundEmailAlert
  || mongoose.model('InboundEmailAlert', inboundEmailAlertSchema);
