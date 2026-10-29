// Se crea el router para agrupar las rutas del carrito y mantener el código organizado.
// Se monta en app.js con app.use('/carrito', carritoRoutes): aquí '/' significa '/carrito'.
// Todas las acciones son POST de formulario: las resuelve el controlador y luego redirige.
const router = require('express').Router();
const carritoController = require('../controllers/carritoController');

// Ver el carrito (lo puede ver cualquiera, con o sin sesión).
router.get('/', carritoController.ver);

// HU-022 a HU-024: agregar, cambiar cantidad y eliminar productos.
router.post('/agregar', carritoController.agregar);
router.post('/cantidad', carritoController.cantidad);
router.post('/eliminar', carritoController.eliminar);

// HU-028: confirmar la compra. Sin sesión, el controlador manda al login (HU-004).
router.post('/confirmar', carritoController.confirmar);

module.exports = router;
