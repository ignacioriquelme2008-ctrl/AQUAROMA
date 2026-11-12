
const router = require('express').Router();
const inicioController = require('../controllers/inicioController');

router.get('/', inicioController.inicio);
router.get('/nosotros', inicioController.nosotros);

module.exports = router;
