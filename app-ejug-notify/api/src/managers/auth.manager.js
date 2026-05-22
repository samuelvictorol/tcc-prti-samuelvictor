const bcrypt = require('bcryptjs')
const User = require('../models/User.model')
const AppError = require('../errors/AppError')
const { signToken } = require('../services/token.service')
const { toUserDTO } = require('../dtos/user.dto')

async function login ({ email, password }) {
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() })

  if (!user) {
    throw new AppError('E-mail ou senha inválidos.', 401)
  }

  const passwordMatches = await bcrypt.compare(password || '', user.passwordHash)

  if (!passwordMatches) {
    throw new AppError('E-mail ou senha inválidos.', 401)
  }

  const token = signToken(user)

  return {
    token,
    user: toUserDTO(user)
  }
}

module.exports = {
  login
}
