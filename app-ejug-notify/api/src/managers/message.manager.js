const Contact = require('../models/Contact.model')
const MessageLog = require('../models/MessageLog.model')
const AppError = require('../errors/AppError')
const whatsappService = require('../services/whatsapp.service')
const { addMessageJob } = require('../queues/message.queue')

async function createSimulatedLog ({ contact, body, campaign = null }) {
  return MessageLog.create({
    campaign,
    contact: contact._id,
    phone: contact.phone,
    body,
    status: 'SIMULATED',
    errorMessage: 'Envio real não executado porque as credenciais da Meta não estão configuradas.'
  })
}

/**
 * Notificação rápida para validação do fluxo individual.
 * Se a Meta não estiver configurada, o envio real é substituído por simulação segura.
 */
async function quickNotify ({ contactId, message }) {
  if (!contactId || !message) {
    throw new AppError('Informe contato e mensagem.')
  }

  const contact = await Contact.findById(contactId)

  if (!contact) {
    throw new AppError('Contato não encontrado.', 404)
  }

  if (!contact.hasOptIn) {
    throw new AppError('Contato não possui opt-in ativo para receber notificações.', 422)
  }

  const status = whatsappService.getWhatsappStatus()

  if (!status.configured) {
    const log = await createSimulatedLog({ contact, body: message })

    return {
      simulated: true,
      message: status.message,
      log
    }
  }

  const log = await MessageLog.create({
    contact: contact._id,
    phone: contact.phone,
    body: message,
    status: 'QUEUED'
  })

  await addMessageJob({
    messageLogId: log._id,
    phone: contact.phone,
    body: message
  })

  return {
    queued: true,
    log
  }
}

module.exports = {
  quickNotify,
  createSimulatedLog
}
