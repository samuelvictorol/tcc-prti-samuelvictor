const templateManager = require('../managers/template.manager')

async function list (req, res, next) {
  try {
    return res.json(await templateManager.list(req.query))
  } catch (error) {
    return next(error)
  }
}

async function create (req, res, next) {
  try {
    return res.status(201).json(await templateManager.create(req.body))
  } catch (error) {
    return next(error)
  }
}

async function remove (req, res, next) {
  try {
    return res.json(await templateManager.remove(req.params.id))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  create,
  remove
}
