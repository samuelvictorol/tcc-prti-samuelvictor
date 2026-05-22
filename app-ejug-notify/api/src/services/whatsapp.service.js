const axios = require('axios')
const AppError = require('../errors/AppError')
const { env, isWhatsappConfigured, getMissingWhatsappVariables } = require('../config/env')

function getWhatsappStatus () {
  const missingVariables = getMissingWhatsappVariables()

  return {
    provider: 'META_WHATSAPP_CLOUD_API',
    configured: missingVariables.length === 0,
    whatsappConfigured: missingVariables.length === 0,
    missingVariables,
    message: missingVariables.length === 0
      ? 'WhatsApp Cloud API configurado.'
      : 'Credenciais da Meta não configuradas. O app permanece disponível para cadastros e simulações.'
  }
}

/**
 * Envia uma mensagem de texto pela API oficial da Meta.
 * Esta função só realiza envio real quando as credenciais estão configuradas.
 */
async function sendTextMessage ({ to, body }) {
  if (!isWhatsappConfigured()) {
    throw new AppError(
      'WhatsApp Cloud API ainda não configurada. Configure as variáveis da Meta para realizar envio real.',
      422,
      getWhatsappStatus()
    )
  }

  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body
    }
  }

  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json'
    }
  })

  return data
}

module.exports = {
  getWhatsappStatus,
  sendTextMessage
}
