const { Router } = require('express')
const metaController = require('../controllers/meta.controller')

const router = Router()

router.get('/status', metaController.status)

module.exports = router
