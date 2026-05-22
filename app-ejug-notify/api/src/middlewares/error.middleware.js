const AppError = require('../errors/AppError')

function errorMiddleware (error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details
    })
  }

  console.error('[error]', error)

  return res.status(500).json({
    message: 'Erro interno no servidor.'
  })
}

module.exports = errorMiddleware
