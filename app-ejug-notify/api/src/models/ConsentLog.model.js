const mongoose = require('mongoose')

const ConsentLogSchema = new mongoose.Schema({
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },

  type: {
    type: String,
    enum: ['OPT_IN', 'OPT_OUT'],
    required: true
  },

  source: {
    type: String,
    default: 'Sistema'
  },

  details: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('ConsentLog', ConsentLogSchema)
