const IORedis = require('ioredis')
const { env } = require('../config/env')

const connection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null
})

module.exports = connection
