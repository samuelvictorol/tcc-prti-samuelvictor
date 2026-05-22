const { Worker } = require('bullmq')
const connection = require('../queues/redis.connection')
const MessageLog = require('../models/MessageLog.model')
const whatsappService = require('../services/whatsapp.service')

function startMessageWorker () {
  const worker = new Worker('message-queue', async (job) => {
    const { messageLogId, phone, body } = job.data

    const log = await MessageLog.findById(messageLogId)

    if (!log) {
      return null
    }

    try {
      const result = await whatsappService.sendTextMessage({ to: phone, body })

      log.status = 'SENT'
      log.providerMessageId = result?.messages?.[0]?.id || ''
      log.sentAt = new Date()
      await log.save()

      return result
    } catch (error) {
      log.status = 'FAILED'
      log.errorMessage = error?.message || 'Falha ao enviar mensagem.'
      await log.save()
      throw error
    }
  }, {
    connection,
    concurrency: 5,
    limiter: {
      max: Number(process.env.MESSAGE_RATE_LIMIT_PER_SECOND || 10),
      duration: 1000
    }
  })

  worker.on('completed', (job) => {
    console.log(`[worker] Mensagem processada: ${job.id}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[worker] Falha no job ${job?.id}:`, error.message)
  })

  return worker
}

module.exports = {
  startMessageWorker
}
