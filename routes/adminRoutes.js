// Rutas del panel de administración (HU-006). Se montan en app.js con: app.use('/admin', adminRoutes)
// Por eso aquí '/' significa '/admin'.
const router = require('express').Router();
const { requiereSesion, soloAdmin, requierePermiso } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const adminProductosController = require('../controllers/adminProductosController');

// router.use aplica los dos guardias a TODAS las rutas de este archivo:
// 1) requiereSesion: sin sesión -> al login.   2) soloAdmin: si no es administrador -> "Acceso denegado".
// Las rutas que agreguen HU-035 a HU-040 quedan protegidas automáticamente.
router.use(requiereSesion, soloAdmin);

router.get('/', adminController.panel);

// HU-036: productos. Además de ser administrador, se necesita el permiso "gestionar_productos".
// Aquí '/productos' significa '/admin/productos'.
const puedeGestionarProductos = requierePermiso('gestionar_productos');
router.get('/productos', puedeGestionarProductos, adminProductosController.listar);
router.get('/productos/nuevo', puedeGestionarProductos, adminProductosController.mostrarFormulario);
router.post('/productos', puedeGestionarProductos, adminProductosController.crear);

module.exports = router;
