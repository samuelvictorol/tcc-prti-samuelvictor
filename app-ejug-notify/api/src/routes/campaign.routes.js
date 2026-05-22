const { Router } = require('express')
const campaignController = require('../controllers/campaign.controller')

const router = Router()

router.get('/', campaignController.list)
router.post('/', campaignController.create)
router.delete('/:id', campaignController.remove)
router.post('/:id/dispatch', campaignController.dispatch)

module.exports = router
