const contactManager = require('../managers/contact.manager')

async function list (req, res, next) {
  try {
    return res.json(await contactManager.list(req.query))
  } catch (error) {
    return next(error)
  }
}

async function create (req, res, next) {
  try {
    return res.status(201).json(await contactManager.create(req.body))
  } catch (error) {
    return next(error)
  }
}

async function remove (req, res, next) {
  try {
    return res.json(await contactManager.remove(req.params.id))
  } catch (error) {
    return next(error)
  }
}

async function optIn (req, res, next) {
  try {
    return res.json(await contactManager.optIn(req.params.id))
  } catch (error) {
    return next(error)
  }
}

async function optOut (req, res, next) {
  try {
    return res.json(await contactManager.optOut(req.params.id))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  create,
  remove,
  optIn,
  optOut
}
