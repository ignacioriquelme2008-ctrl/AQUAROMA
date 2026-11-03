// Rutas de la sección PEDIDOS del cliente. Se montan en app.js con: app.use('/pedidos', pedidosRoutes)
// Por eso aquí '/' significa '/pedidos'.
const router = require('express').Router();
const { requiereSesion, requierePermiso } = require('../middlewares/auth');
const pedidosController = require('../controllers/pedidosController');

// Sin sesión -> al login. Con sesión pero sin el permiso del rol Cliente (por ejemplo el administrador) -> "Acceso denegado".
router.use(requiereSesion, requierePermiso('ver_mis_pedidos'));

router.get('/', pedidosController.listar);                       // Mis pedidos
router.get('/:id(\\d+)/comprobante', pedidosController.comprobante); // HU-028: comprobante de compra
router.post('/:id(\\d+)/cancelar', pedidosController.cancelar); // HU-034: cancelación antes del despacho
router.get('/:id(\\d+)', pedidosController.ver);                 // HU-032: estado y seguimiento (solo números)

module.exports = router;
