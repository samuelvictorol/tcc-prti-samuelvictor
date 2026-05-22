const mongoose = require('mongoose')

const CampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },

  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageTemplate',
    required: true
  },

  scheduledAt: Date,

  status: {
    type: String,
    enum: ['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'SIMULATED'],
    default: 'DRAFT',
    index: true
  },

  stats: {
    total: {
      type: Number,
      default: 0
    },
    queued: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    simulated: {
      type: Number,
      default: 0
    }
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Campaign', CampaignSchema)
