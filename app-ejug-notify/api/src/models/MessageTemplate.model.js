const mongoose = require('mongoose')

const MessageTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'],
    default: 'UTILITY'
  },

  language: {
    type: String,
    default: 'pt_BR'
  },

  metaTemplateName: {
    type: String,
    trim: true
  },

  body: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_META_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'DRAFT'
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('MessageTemplate', MessageTemplateSchema)
