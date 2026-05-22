const webhookManager = require('../managers/webhook.manager')

async function verify (req, res) {
  const challenge = webhookManager.verifyWebhook(req.query)

  if (!challenge) {
    return res.sendStatus(403)
  }

  return res.status(200).send(challenge)
}

async function receive (req, res, next) {
  try {
    const result = await webhookManager.handleWebhookEvent(req.body)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  verify,
  receive
}
