const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const routes = require('./routes')
const errorMiddleware = require('./middlewares/error.middleware')
const { env } = require('./config/env')

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  }
}))

app.use(cors({
  origin: env.appUrl || '*',
  credentials: true
}))

app.use(express.json({
  limit: '2mb'
}))

app.use(morgan('dev'))

app.use('/api', routes)

app.use((req, res) => {
  return res.status(404).json({
    message: 'Rota não encontrada.'
  })
})

app.use(errorMiddleware)

module.exports = app
