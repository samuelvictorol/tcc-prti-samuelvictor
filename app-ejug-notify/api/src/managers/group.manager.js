const Group = require('../models/Group.model')
const Contact = require('../models/Contact.model')
const AppError = require('../errors/AppError')
const { normalizeString } = require('../normalizers/text.normalizer')
const { toGroupDTO, toGroupListDTO } = require('../dtos/group.dto')

async function list () {
  const groups = await Group.find()
    .populate('contacts', 'name phone hasOptIn')
    .sort({ createdAt: -1 })

  return toGroupListDTO(groups)
}

/**
 * Cria uma turma/grupo e vincula contatos já cadastrados.
 */
async function create (payload) {
  if (!payload.name) {
    throw new AppError('Informe o nome da turma/grupo.')
  }

  const contactIds = Array.isArray(payload.contactIds) ? payload.contactIds : []

  if (contactIds.length) {
    const count = await Contact.countDocuments({ _id: { $in: contactIds } })

    if (count !== contactIds.length) {
      throw new AppError('Um ou mais contatos informados não existem.')
    }
  }

  const group = await Group.create({
    name: normalizeString(payload.name),
    description: normalizeString(payload.description),
    contacts: contactIds
  })

  await group.populate('contacts', 'name phone hasOptIn')

  return toGroupDTO(group)
}

async function remove (id) {
  await Group.findByIdAndDelete(id)
  return { deleted: true }
}

module.exports = {
  list,
  create,
  remove
}
