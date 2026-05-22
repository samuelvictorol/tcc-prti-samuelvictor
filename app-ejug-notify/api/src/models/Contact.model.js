const mongoose = require('mongoose')

const ContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  document: {
    type: String,
    trim: true
  },

  source: {
    type: String,
    default: 'Cadastro manual'
  },

  hasOptIn: {
    type: Boolean,
    default: false,
    index: true
  },

  optInAt: Date,
  optOutAt: Date,

  active: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Contact', ContactSchema)
