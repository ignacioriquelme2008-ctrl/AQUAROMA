// Rutas de la sección CATÁLOGO: lista de productos (HU-013 a HU-015, HU-017) y ficha de cada uno (HU-016).
// Se montan en app.js con app.use('/catalogo', catalogoRoutes): aquí '/' significa '/catalogo'.
const router = require('express').Router();
// Se importa el controlador que lista los productos y arma la ficha de cada uno.
const catalogoController = require('../controllers/catalogoController');

// Esta ruta muestra la lista principal de productos cuando se entra a la URL del catálogo.
router.get('/', catalogoController.listar);
// Ficha de un producto, por ejemplo /catalogo/9 (HU-016). "(\\d+)" acepta solo números: /catalogo/abc no entra aquí.
router.get('/:id(\\d+)', catalogoController.detalle);

module.exports = router;
