


const router = require('express').Router();
const carritoController = require('../controllers/carritoController');


router.get('/', carritoController.ver);


router.post('/agregar', carritoController.agregar);
router.post('/cantidad', carritoController.cantidad);
router.post('/eliminar', carritoController.eliminar);


router.post('/confirmar', carritoController.confirmar);

module.exports = router;
