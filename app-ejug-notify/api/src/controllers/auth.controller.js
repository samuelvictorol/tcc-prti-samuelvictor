const authManager = require('../managers/auth.manager')
const { toUserDTO } = require('../dtos/user.dto')

async function login (req, res, next) {
  try {
    const data = await authManager.login(req.body)
    return res.json(data)
  } catch (error) {
    return next(error)
  }
}

async function me (req, res) {
  return res.json({
    user: toUserDTO(req.user)
  })
}

module.exports = {
  login,
  me
}
