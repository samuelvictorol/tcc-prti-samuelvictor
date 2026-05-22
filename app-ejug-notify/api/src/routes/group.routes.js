const { Router } = require('express')
const groupController = require('../controllers/group.controller')

const router = Router()

router.get('/', groupController.list)
router.post('/', groupController.create)
router.delete('/:id', groupController.remove)

module.exports = router
