const { Router } = require('express')
const contactController = require('../controllers/contact.controller')

const router = Router()

router.get('/', contactController.list)
router.post('/', contactController.create)
router.delete('/:id', contactController.remove)
router.post('/:id/opt-in', contactController.optIn)
router.post('/:id/opt-out', contactController.optOut)

module.exports = router
