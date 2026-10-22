// Controlador de la sección INICIO: página principal (HU-008) y "Nosotros" (HU-010).
const Producto = require('../models/Producto');

// Página principal con los productos destacados.
exports.inicio = async (req, res, next) => {
  try {
    const destacados = await Producto.obtenerDestacados(3);
    res.render('inicio/inicio', { destacados });
  } catch (err) {
    next(err);   // lo atiende el manejador de errores de app.js (muestra views/errores/error.ejs)
  }
};

// Página informativa "Nosotros": no necesita datos de la base.
exports.nosotros = (req, res) => {
  res.render('inicio/nosotros');
};
