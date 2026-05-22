const ConsentLog = require('../models/ConsentLog.model')

/**
 * Registra alterações de consentimento para auditoria e LGPD.
 */
async function registerConsent ({ contact, type, source = 'Sistema', details = {} }) {
  return ConsentLog.create({
    contact,
    type,
    source,
    details
  })
}

module.exports = {
  registerConsent
}
