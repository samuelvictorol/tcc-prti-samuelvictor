const { Router } = require('express')
const messageController = require('../controllers/message.controller')

const router = Router()

router.post('/quick-notify', messageController.quickNotify)

module.exports = router
