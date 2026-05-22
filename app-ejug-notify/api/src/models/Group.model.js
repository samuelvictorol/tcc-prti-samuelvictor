const mongoose = require('mongoose')

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  }],

  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Group', GroupSchema)
