// Rutas públicas del formulario de contacto (HU-012).
const router = require('express').Router();
const contactoController = require('../controllers/contactoController');

router.get('/', contactoController.mostrar);
router.post('/', contactoController.enviar);

module.exports = router;
