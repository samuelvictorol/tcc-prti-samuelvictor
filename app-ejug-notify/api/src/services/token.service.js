const jwt = require('jsonwebtoken')
const { env } = require('../config/env')

function signToken (user) {
  return jwt.sign(
    {
      role: user.role
    },
    env.jwtSecret,
    {
      subject: String(user._id),
      expiresIn: env.jwtExpiresIn
    }
  )
}

module.exports = {
  signToken
}
