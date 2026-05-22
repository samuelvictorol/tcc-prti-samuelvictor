const MessageTemplate = require('../models/MessageTemplate.model')
const AppError = require('../errors/AppError')
const { normalizeString, normalizeMessageBody } = require('../normalizers/text.normalizer')
const { toTemplateDTO, toTemplateListDTO } = require('../dtos/template.dto')

async function list () {
  const templates = await MessageTemplate.find().sort({ createdAt: -1 })
  return toTemplateListDTO(templates)
}

/**
 * Cria template interno. Em produção, o mesmo conteúdo deve ser refletido/aprovado na Meta.
 */
async function create (payload) {
  if (!payload.name || !payload.body) {
    throw new AppError('Informe nome e corpo do template.')
  }

  const template = await MessageTemplate.create({
    name: normalizeString(payload.name),
    category: payload.category || 'UTILITY',
    language: normalizeString(payload.language) || 'pt_BR',
    metaTemplateName: normalizeString(payload.metaTemplateName),
    body: normalizeMessageBody(payload.body),
    status: payload.metaTemplateName ? 'PENDING_META_APPROVAL' : 'DRAFT'
  })

  return toTemplateDTO(template)
}

async function remove (id) {
  await MessageTemplate.findByIdAndDelete(id)
  return { deleted: true }
}

module.exports = {
  list,
  create,
  remove
}
