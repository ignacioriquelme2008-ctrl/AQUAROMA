

const router = require('express').Router();
const { requiereSesion, requierePermiso } = require('../middlewares/auth');
const pedidosController = require('../controllers/pedidosController');


router.use(requiereSesion, requierePermiso('ver_mis_pedidos'));

router.get('/', pedidosController.listar);
router.get('/:id(\\d+)/comprobante', pedidosController.comprobante);
router.post('/:id(\\d+)/cancelar', pedidosController.cancelar);
router.get('/:id(\\d+)', pedidosController.ver);

module.exports = router;
