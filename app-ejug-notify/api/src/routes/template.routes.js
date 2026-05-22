const { Router } = require('express')
const templateController = require('../controllers/template.controller')

const router = Router()

router.get('/', templateController.list)
router.post('/', templateController.create)
router.delete('/:id', templateController.remove)

module.exports = router
