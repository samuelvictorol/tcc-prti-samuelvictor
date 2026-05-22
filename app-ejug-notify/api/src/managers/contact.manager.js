const Contact = require('../models/Contact.model')
const AppError = require('../errors/AppError')
const { normalizePhone } = require('../normalizers/phone.normalizer')
const { normalizeString } = require('../normalizers/text.normalizer')
const { normalizePagination } = require('../normalizers/pagination.normalizer')
const { toContactDTO, toContactListDTO } = require('../dtos/contact.dto')
const consentManager = require('./consent.manager')

async function list (query = {}) {
  const { limit, skip } = normalizePagination(query)

  const filters = {}

  if (query.search) {
    filters.$or = [
      { name: new RegExp(query.search, 'i') },
      { phone: new RegExp(query.search, 'i') },
      { email: new RegExp(query.search, 'i') }
    ]
  }

  const contacts = await Contact.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  return toContactListDTO(contacts)
}

/**
 * Cria contato normalizando telefone e já registra opt-in quando informado.
 */
async function create (payload) {
  const phone = normalizePhone(payload.phone)

  if (!payload.name || !phone) {
    throw new AppError('Informe nome e telefone do contato.')
  }

  const exists = await Contact.findOne({ phone })

  if (exists) {
    throw new AppError('Já existe um contato com esse telefone.')
  }

  const hasOptIn = Boolean(payload.hasOptIn)

  const contact = await Contact.create({
    name: normalizeString(payload.name),
    phone,
    email: normalizeString(payload.email),
    document: normalizeString(payload.document),
    source: normalizeString(payload.source) || 'Cadastro manual',
    hasOptIn,
    optInAt: hasOptIn ? new Date() : null
  })

  if (hasOptIn) {
    await consentManager.registerConsent({
      contact: contact._id,
      type: 'OPT_IN',
      source: contact.source,
      details: {
        createdFrom: 'contact.create'
      }
    })
  }

  return toContactDTO(contact)
}

async function remove (id) {
  await Contact.findByIdAndDelete(id)
  return { deleted: true }
}

async function optIn (id) {
  const contact = await Contact.findById(id)

  if (!contact) {
    throw new AppError('Contato não encontrado.', 404)
  }

  contact.hasOptIn = true
  contact.optInAt = new Date()
  contact.optOutAt = null
  await contact.save()

  await consentManager.registerConsent({
    contact: contact._id,
    type: 'OPT_IN',
    source: 'Painel administrativo'
  })

  return toContactDTO(contact)
}

async function optOut (id) {
  const contact = await Contact.findById(id)

  if (!contact) {
    throw new AppError('Contato não encontrado.', 404)
  }

  contact.hasOptIn = false
  contact.optOutAt = new Date()
  await contact.save()

  await consentManager.registerConsent({
    contact: contact._id,
    type: 'OPT_OUT',
    source: 'Painel administrativo'
  })

  return toContactDTO(contact)
}

module.exports = {
  list,
  create,
  remove,
  optIn,
  optOut
}
