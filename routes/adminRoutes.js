

const router = require('express').Router();
const { requiereSesion, soloAdmin, requierePermiso } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const adminProductosController = require('../controllers/adminProductosController');
const adminStockController = require('../controllers/adminStockController');
const adminPedidosController = require('../controllers/adminPedidosController');
const adminMensajesController = require('../controllers/adminMensajesController');
const { recibirImagenProducto } = require('../middlewares/imagenProducto');




router.use(requiereSesion, soloAdmin);


router.get('/', requierePermiso('ver_panel_admin'), adminController.panel);



const puedeGestionarProductos = requierePermiso('gestionar_productos');
router.get('/productos', puedeGestionarProductos, adminProductosController.listar);
router.get('/productos/nuevo', puedeGestionarProductos, adminProductosController.mostrarFormulario);
router.post('/productos', puedeGestionarProductos, recibirImagenProducto, adminProductosController.crear);
router.get('/productos/:id(\\d+)/editar', puedeGestionarProductos, adminProductosController.mostrarEdicion);
router.post('/productos/:id(\\d+)', puedeGestionarProductos, recibirImagenProducto, adminProductosController.guardarEdicion);
router.post('/productos/:id(\\d+)/activo', puedeGestionarProductos, adminProductosController.cambiarActivo);
router.post('/productos/:id(\\d+)/eliminar', puedeGestionarProductos, adminProductosController.eliminar);


const puedeGestionarStock = requierePermiso('gestionar_stock');
router.get('/stock', puedeGestionarStock, adminStockController.ver);
router.post('/stock/ajuste', puedeGestionarStock, adminStockController.ajustar);
router.post('/stock/minimo', puedeGestionarStock, adminStockController.cambiarMinimo);


const puedeGestionarPedidos = requierePermiso('gestionar_pedidos');
router.get('/pedidos', puedeGestionarPedidos, adminPedidosController.listar);
router.get('/pedidos/:id(\\d+)', puedeGestionarPedidos, adminPedidosController.ver);
router.post('/pedidos/:id(\\d+)/estado', puedeGestionarPedidos, adminPedidosController.cambiarEstado);


const puedeVerMensajes = requierePermiso('ver_mensajes');
router.get('/mensajes', puedeVerMensajes, adminMensajesController.listar);
router.post('/mensajes/:id(\\d+)/leido', puedeVerMensajes, adminMensajesController.marcarLeido);

module.exports = router;
