// Se crea el router para agrupar las rutas del carrito y mantener el código organizado.
// Se monta en app.js con app.use('/carrito', carritoRoutes): aquí '/' significa '/carrito'.
const router = require('express').Router();
// Se importa el controlador que contiene la lógica del carrito.
const carritoController = require('../controllers/carritoController');
const { soloClienteApi } = require('../middlewares/auth');

// Esta ruta muestra la página del carrito (la puede ver cualquiera, con o sin sesión).
router.get('/', carritoController.ver);

// HU-026: carrito guardado en la cuenta. Solo para clientes con sesión iniciada.
// Las usa public/js/carrito.js por detrás (fetch) y responden en JSON, no con una página.
router.get('/api', soloClienteApi, carritoController.obtener);           // leer el carrito de la cuenta
router.put('/api', soloClienteApi, carritoController.guardar);           // guardar cada cambio
router.post('/api/fusionar', soloClienteApi, carritoController.fusionar); // unir el carrito de visitante al iniciar sesión

module.exports = router;
