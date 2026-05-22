const Campaign = require('../models/Campaign.model')
const Group = require('../models/Group.model')
const MessageTemplate = require('../models/MessageTemplate.model')
const MessageLog = require('../models/MessageLog.model')
const AppError = require('../errors/AppError')
const { normalizeString } = require('../normalizers/text.normalizer')
const { toCampaignDTO, toCampaignListDTO } = require('../dtos/campaign.dto')
const whatsappService = require('../services/whatsapp.service')
const { addMessageJob } = require('../queues/message.queue')

async function list () {
  const campaigns = await Campaign.find()
    .populate('group', 'name description')
    .populate('template', 'name category body')
    .sort({ createdAt: -1 })

  return toCampaignListDTO(campaigns)
}

/**
 * Cria campanha vinculando turma e template.
 */
async function create (payload, user) {
  if (!payload.name || !payload.groupId || !payload.templateId) {
    throw new AppError('Informe nome, turma e template da campanha.')
  }

  const [group, template] = await Promise.all([
    Group.findById(payload.groupId),
    MessageTemplate.findById(payload.templateId)
  ])

  if (!group) {
    throw new AppError('Turma/grupo não encontrado.', 404)
  }

  if (!template) {
    throw new AppError('Template não encontrado.', 404)
  }

  const campaign = await Campaign.create({
    name: normalizeString(payload.name),
    group: group._id,
    template: template._id,
    scheduledAt: payload.scheduledAt || null,
    createdBy: user?._id
  })

  await campaign.populate('group', 'name description')
  await campaign.populate('template', 'name category body')

  return toCampaignDTO(campaign)
}

async function remove (id) {
  await Campaign.findByIdAndDelete(id)
  return { deleted: true }
}

function renderMessage (templateBody, contact) {
  return String(templateBody || '')
    .replace(/{{\s*nome\s*}}/gi, contact.name || '')
    .replace(/{{\s*telefone\s*}}/gi, contact.phone || '')
}

/**
 * Dispara a campanha.
 * Regra central: só contatos ativos com opt-in entram no envio.
 * Se a Meta não estiver configurada, o sistema cria logs simulados e não quebra.
 */
async function dispatch (campaignId) {
  const campaign = await Campaign.findById(campaignId)
    .populate({
      path: 'group',
      populate: {
        path: 'contacts',
        select: 'name phone hasOptIn active'
      }
    })
    .populate('template')

  if (!campaign) {
    throw new AppError('Campanha não encontrada.', 404)
  }

  const eligibleContacts = (campaign.group?.contacts || [])
    .filter((contact) => contact.active && contact.hasOptIn)

  if (!eligibleContacts.length) {
    throw new AppError('Nenhum contato elegível com opt-in ativo foi encontrado nesta turma.', 422)
  }

  const whatsappStatus = whatsappService.getWhatsappStatus()

  campaign.stats.total = eligibleContacts.length

  if (!whatsappStatus.configured) {
    const logs = await MessageLog.insertMany(
      eligibleContacts.map((contact) => ({
        campaign: campaign._id,
        contact: contact._id,
        phone: contact.phone,
        body: renderMessage(campaign.template.body, contact),
        status: 'SIMULATED',
        errorMessage: 'Envio real não executado porque as credenciais da Meta não estão configuradas.'
      }))
    )

    campaign.status = 'SIMULATED'
    campaign.stats.simulated = logs.length
    await campaign.save()

    return {
      simulated: true,
      message: whatsappStatus.message,
      campaign: toCampaignDTO(campaign),
      total: logs.length,
      missingVariables: whatsappStatus.missingVariables
    }
  }

  const logs = []

  for (const contact of eligibleContacts) {
    const body = renderMessage(campaign.template.body, contact)

    const log = await MessageLog.create({
      campaign: campaign._id,
      contact: contact._id,
      phone: contact.phone,
      body,
      status: 'QUEUED'
    })

    await addMessageJob({
      messageLogId: log._id,
      phone: contact.phone,
      body
    })

    logs.push(log)
  }

  campaign.status = 'QUEUED'
  campaign.stats.queued = logs.length
  await campaign.save()

  return {
    queued: true,
    campaign: toCampaignDTO(campaign),
    total: logs.length
  }
}

module.exports = {
  list,
  create,
  remove,
  dispatch
}
