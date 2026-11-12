

const router = require('express').Router();

const catalogoController = require('../controllers/catalogoController');


router.get('/', catalogoController.listar);

router.get('/:id(\\d+)', catalogoController.detalle);

module.exports = router;
