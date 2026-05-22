const app = require('./app')
const { env } = require('./config/env')
const { connectDatabase } = require('./config/database')
const { startMessageWorker } = require('./jobs/message.worker')

async function bootstrap () {
  await connectDatabase()

  startMessageWorker()

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[server] API rodando em http://localhost:${env.port}/api`)
  })
}

bootstrap().catch((error) => {
  console.error('[bootstrap] Falha ao iniciar API:', error)
  process.exit(1)
})
