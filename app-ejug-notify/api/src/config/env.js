require('dotenv').config()

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',

  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ejug_notify',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtSecret: process.env.JWT_SECRET || 'local-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'ejug-local-verify-token',

  messageRateLimitPerSecond: Number(process.env.MESSAGE_RATE_LIMIT_PER_SECOND || 10),
  messageMaxRetries: Number(process.env.MESSAGE_MAX_RETRIES || 3),
  messageRetryBackoffMs: Number(process.env.MESSAGE_RETRY_BACKOFF_MS || 30000),

  defaultCampaignWindowStart: process.env.DEFAULT_CAMPAIGN_WINDOW_START || '08:00',
  defaultCampaignWindowEnd: process.env.DEFAULT_CAMPAIGN_WINDOW_END || '18:00',

  optOutKeywords: String(process.env.OPT_OUT_KEYWORDS || 'SAIR,PARAR,CANCELAR,STOP')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

function getMissingWhatsappVariables () {
  const missing = []

  if (!env.whatsappPhoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID')
  if (!env.whatsappBusinessAccountId) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID')
  if (!env.whatsappAccessToken) missing.push('WHATSAPP_ACCESS_TOKEN')

  return missing
}

function isWhatsappConfigured () {
  return getMissingWhatsappVariables().length === 0
}

module.exports = {
  env,
  getMissingWhatsappVariables,
  isWhatsappConfigured
}
