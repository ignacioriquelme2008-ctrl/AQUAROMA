
const Producto = require('../models/Producto');


exports.inicio = async (req, res, next) => {
  try {
    const destacados = await Producto.obtenerDestacados(3);
    res.render('inicio/inicio', { destacados });
  } catch (err) {
    next(err);
  }
};


exports.nosotros = (req, res) => {
  res.render('inicio/nosotros');
};
