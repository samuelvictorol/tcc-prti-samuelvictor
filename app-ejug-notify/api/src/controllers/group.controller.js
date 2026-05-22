const groupManager = require('../managers/group.manager')

async function list (req, res, next) {
  try {
    return res.json(await groupManager.list(req.query))
  } catch (error) {
    return next(error)
  }
}

async function create (req, res, next) {
  try {
    return res.status(201).json(await groupManager.create(req.body))
  } catch (error) {
    return next(error)
  }
}

async function remove (req, res, next) {
  try {
    return res.json(await groupManager.remove(req.params.id))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list,
  create,
  remove
}
