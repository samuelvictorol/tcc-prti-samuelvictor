const whatsappService = require('../services/whatsapp.service')

async function status (req, res) {
  return res.json({
    api: 'online',
    ...whatsappService.getWhatsappStatus()
  })
}

module.exports = {
  status
}
