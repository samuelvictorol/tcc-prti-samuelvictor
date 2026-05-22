const { Router } = require('express')
const authMiddleware = require('../middlewares/auth.middleware')

const authRoutes = require('./auth.routes')
const contactRoutes = require('./contact.routes')
const groupRoutes = require('./group.routes')
const templateRoutes = require('./template.routes')
const campaignRoutes = require('./campaign.routes')
const messageRoutes = require('./message.routes')
const metaRoutes = require('./meta.routes')
const webhookRoutes = require('./webhook.routes')

const router = Router()

router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    service: 'ejug-notify-api',
    timestamp: new Date().toISOString()
  })
})

router.use('/auth', authRoutes)
router.use('/webhooks', webhookRoutes)

router.use(authMiddleware)

router.use('/contacts', contactRoutes)
router.use('/groups', groupRoutes)
router.use('/templates', templateRoutes)
router.use('/campaigns', campaignRoutes)
router.use('/messages', messageRoutes)
router.use('/meta', metaRoutes)

module.exports = router
