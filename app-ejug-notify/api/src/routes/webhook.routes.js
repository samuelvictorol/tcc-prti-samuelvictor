const { Router } = require('express')
const webhookController = require('../controllers/webhook.controller')

const router = Router()

router.get('/whatsapp', webhookController.verify)
router.post('/whatsapp', webhookController.receive)

module.exports = router
