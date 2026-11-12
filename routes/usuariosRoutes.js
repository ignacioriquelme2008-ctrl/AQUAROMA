
const router = require('express').Router();
const usuariosController = require('../controllers/usuariosController');


router.get('/registro', usuariosController.mostrarRegistro);
router.post('/registro', usuariosController.registrar);
router.get('/login', usuariosController.mostrarLogin);
router.post('/login', usuariosController.login);

router.get('/recuperar', usuariosController.mostrarRecuperacion);
router.post('/recuperar', usuariosController.solicitarRecuperacion);
router.get('/recuperar/:token', usuariosController.mostrarNuevaPassword);
router.post('/recuperar/:token', usuariosController.restablecerPassword);

router.post('/logout', usuariosController.logout);

module.exports = router;
