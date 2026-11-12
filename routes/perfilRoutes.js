


const router = require('express').Router();
const { requiereSesion, requiereCliente } = require('../middlewares/auth');
const perfilController = require('../controllers/perfilController');


router.use(requiereSesion, requiereCliente);

router.get('/', perfilController.ver);

router.post('/datos', perfilController.guardarDatos);
router.post('/password', perfilController.cambiarPassword);

router.post('/direcciones', perfilController.crearDireccion);
router.post('/direcciones/:id(\\d+)', perfilController.editarDireccion);
router.post('/direcciones/:id(\\d+)/principal', perfilController.marcarPrincipal);
router.post('/direcciones/:id(\\d+)/eliminar', perfilController.eliminarDireccion);


router.post('/favoritos', perfilController.crearFavorito);
router.post('/favoritos/:id(\\d+)/carrito', perfilController.favoritoAlCarrito);
router.post('/favoritos/:id(\\d+)/eliminar', perfilController.eliminarFavorito);

module.exports = router;
