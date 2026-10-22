// Rutas de la sección INICIO: la página principal (HU-008) y "Nosotros" (HU-010).
const router = require('express').Router();
const inicioController = require('../controllers/inicioController');

router.get('/', inicioController.inicio);
router.get('/nosotros', inicioController.nosotros);

module.exports = router;
