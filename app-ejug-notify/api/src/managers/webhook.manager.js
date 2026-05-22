const { env } = require('../config/env')
const MessageLog = require('../models/MessageLog.model')

function verifyWebhook (query) {
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  if (mode === 'subscribe' && token === env.whatsappVerifyToken) {
    return challenge
  }

  return null
}

/**
 * Processa eventos recebidos da Meta.
 * MVP: registra no log e atualiza status quando houver providerMessageId conhecido.
 */
async function handleWebhookEvent (payload) {
  const entries = payload?.entry || []

  for (const entry of entries) {
    const changes = entry?.changes || []

    for (const change of changes) {
      const statuses = change?.value?.statuses || []

      for (const status of statuses) {
        const providerMessageId = status.id
        const messageLog = await MessageLog.findOne({ providerMessageId })

        if (messageLog) {
          if (status.status === 'delivered') {
            messageLog.status = 'DELIVERED'
            messageLog.deliveredAt = new Date()
          }

          if (status.status === 'read') {
            messageLog.status = 'READ'
            messageLog.readAt = new Date()
          }

          if (status.status === 'failed') {
            messageLog.status = 'FAILED'
            messageLog.errorMessage = status?.errors?.[0]?.title || 'Falha retornada pela Meta.'
          }

          await messageLog.save()
        }
      }
    }
  }

  return { received: true }
}

module.exports = {
  verifyWebhook,
  handleWebhookEvent
}
