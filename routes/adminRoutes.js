// Rutas del panel de administración (HU-006). Se montan en app.js con: app.use('/admin', adminRoutes)
// Por eso aquí '/' significa '/admin'.
const router = require('express').Router();
const { requiereSesion, soloAdmin, requierePermiso } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const adminProductosController = require('../controllers/adminProductosController');
const adminStockController = require('../controllers/adminStockController');
const adminPedidosController = require('../controllers/adminPedidosController');
const adminMensajesController = require('../controllers/adminMensajesController');

// router.use aplica los dos guardias a TODAS las rutas de este archivo:
// 1) requiereSesion: sin sesión -> al login.   2) soloAdmin: si no es administrador -> "Acceso denegado".
// Las rutas que agreguen HU-035 a HU-040 quedan protegidas automáticamente.
router.use(requiereSesion, soloAdmin);

// HU-035: portada del panel con el resumen de la tienda.
router.get('/', requierePermiso('ver_panel_admin'), adminController.panel);

// HU-036 y HU-037: productos. Además de ser administrador, se necesita el permiso "gestionar_productos".
// Aquí '/productos' significa '/admin/productos'. ":id(\\d+)" solo acepta números.
const puedeGestionarProductos = requierePermiso('gestionar_productos');
router.get('/productos', puedeGestionarProductos, adminProductosController.listar);
router.get('/productos/nuevo', puedeGestionarProductos, adminProductosController.mostrarFormulario);
router.post('/productos', puedeGestionarProductos, adminProductosController.crear);
router.get('/productos/:id(\\d+)/editar', puedeGestionarProductos, adminProductosController.mostrarEdicion);   // HU-037
router.post('/productos/:id(\\d+)', puedeGestionarProductos, adminProductosController.guardarEdicion);         // HU-037
router.post('/productos/:id(\\d+)/activo', puedeGestionarProductos, adminProductosController.cambiarActivo);   // HU-037
router.post('/productos/:id(\\d+)/eliminar', puedeGestionarProductos, adminProductosController.eliminar);      // HU-037

// HU-038 y HU-039: stock por sucursal y alertas de stock bajo.
const puedeGestionarStock = requierePermiso('gestionar_stock');
router.get('/stock', puedeGestionarStock, adminStockController.ver);
router.post('/stock/ajuste', puedeGestionarStock, adminStockController.ajustar);
router.post('/stock/minimo', puedeGestionarStock, adminStockController.cambiarMinimo);

// HU-040: gestión de pedidos.
const puedeGestionarPedidos = requierePermiso('gestionar_pedidos');
router.get('/pedidos', puedeGestionarPedidos, adminPedidosController.listar);
router.get('/pedidos/:id(\\d+)', puedeGestionarPedidos, adminPedidosController.ver);
router.post('/pedidos/:id(\\d+)/estado', puedeGestionarPedidos, adminPedidosController.cambiarEstado);

// HU-012: lectura de mensajes enviados por clientes y visitantes.
const puedeVerMensajes = requierePermiso('ver_mensajes');
router.get('/mensajes', puedeVerMensajes, adminMensajesController.listar);
router.post('/mensajes/:id(\\d+)/leido', puedeVerMensajes, adminMensajesController.marcarLeido);

module.exports = router;
