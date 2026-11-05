// Endpoints temporales de prueba PayPal; están limitados al modo Sandbox y fuera de producción.
const router = require('express').Router();
const controller = require('../controllers/paypalSandboxController');

router.get('/pago/paypal/sandbox', (req, res) => res.redirect('/carrito'));
router.post('/api/paypal-sandbox/pedidos/:idPedido/orders', controller.crearOrden);
router.post('/api/paypal-sandbox/pedidos/:idPedido/capture', controller.capturarOrden);

module.exports = router;
