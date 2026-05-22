const campaignManager = require('../managers/campaign.manager')

async function list (req, res, next) {
  try {
    return res.json(await campaignManager.list(req.query))
  } catch (error) {
    return next(error)
  }
}

async function create (req, res, next) {
  try {
    return res.status(201).json(await campaignManager.create(req.body, req.user))
  } catch (error) {
    return next(error)
  }
}

async function remove (req, res, next) {
  try {
    return res.json(await campaignManager.remove(req.params.id))
  } catch (error) {
    return next(error)
  }
}

async function dispatch (req, res, next) {
  try {
    return res.json(await campaignManager.dispatch(req.params.id))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  create,
  remove,
  dispatch
}
