const messageManager = require('../managers/message.manager')

async function quickNotify (req, res, next) {
  try {
    return res.json(await messageManager.quickNotify(req.body))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  quickNotify
}
