const { Queue } = require('bullmq')
const connection = require('./redis.connection')
const { env } = require('../config/env')

const messageQueue = new Queue('message-queue', {
  connection,
  defaultJobOptions: {
    attempts: env.messageMaxRetries,
    backoff: {
      type: 'fixed',
      delay: env.messageRetryBackoffMs
    },
    removeOnComplete: 1000,
    removeOnFail: 1000
  }
})

async function addMessageJob (payload) {
  return messageQueue.add('send-message', payload)
}

module.exports = {
  messageQueue,
  addMessageJob
}
