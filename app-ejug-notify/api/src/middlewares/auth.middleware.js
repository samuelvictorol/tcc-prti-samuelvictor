const jwt = require('jsonwebtoken')
const { env } = require('../config/env')
const AppError = require('../errors/AppError')
const User = require('../models/User.model')

async function authMiddleware (req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const [, token] = header.split(' ')

    if (!token) {
      throw new AppError('Token de autenticação não informado.', 401)
    }

    const decoded = jwt.verify(token, env.jwtSecret)
    const user = await User.findById(decoded.sub).select('-passwordHash')

    if (!user) {
      throw new AppError('Usuário não encontrado.', 401)
    }

    req.user = user
    return next()
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError('Sessão inválida ou expirada.', 401))
  }
}

module.exports = authMiddleware
