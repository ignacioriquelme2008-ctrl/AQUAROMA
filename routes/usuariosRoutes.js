// Rutas de la sección USUARIOS: registro (HU-001, HU-002), inicio de sesión (HU-003) y cierre de sesión (HU-004).
const router = require('express').Router();
const usuariosController = require('../controllers/usuariosController');

// GET muestra los formularios y POST recibe el registro y las credenciales del usuario.
router.get('/registro', usuariosController.mostrarRegistro);
router.post('/registro', usuariosController.registrar);
router.get('/login', usuariosController.mostrarLogin);
router.post('/login', usuariosController.login);
// Esta solicitud termina la sesión activa.
router.post('/logout', usuariosController.logout);

module.exports = router;
