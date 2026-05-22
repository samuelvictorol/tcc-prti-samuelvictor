const mongoose = require('mongoose')

const MessageLogSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },

  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },

  phone: {
    type: String,
    required: true
  },

  body: {
    type: String
  },

  status: {
    type: String,
    enum: ['PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SIMULATED'],
    default: 'PENDING',
    index: true
  },

  providerMessageId: String,
  errorMessage: String,

  sentAt: Date,
  deliveredAt: Date,
  readAt: Date
}, {
  timestamps: true
})

module.exports = mongoose.model('MessageLog', MessageLogSchema)
