// Rutas de la sección PERFIL del cliente (HU-007, y luego HU-021 con las favoritas).
// Se montan en app.js con app.use('/perfil', perfilRoutes): aquí '/' significa '/perfil'.
// Todas las acciones son POST de formulario: el controlador guarda y luego redirige (PRG).
const router = require('express').Router();
const { requiereSesion, requiereCliente } = require('../middlewares/auth');
const perfilController = require('../controllers/perfilController');

// Sin sesión -> al login. Con sesión pero sin ficha de cliente (el administrador) -> "Acceso denegado".
router.use(requiereSesion, requiereCliente);

router.get('/', perfilController.ver);                                       // Mis datos, contraseña y direcciones

router.post('/datos', perfilController.guardarDatos);                        // criterio 2: datos personales
router.post('/password', perfilController.cambiarPassword);                  // criterios 3 y 4: contraseña

router.post('/direcciones', perfilController.crearDireccion);                // criterio 2: agregar dirección
router.post('/direcciones/:id(\\d+)', perfilController.editarDireccion);     // criterio 2: editar dirección
router.post('/direcciones/:id(\\d+)/principal', perfilController.marcarPrincipal);
router.post('/direcciones/:id(\\d+)/eliminar', perfilController.eliminarDireccion);

module.exports = router;
