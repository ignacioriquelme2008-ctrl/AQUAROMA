// Controlador de la sección CATÁLOGO: recibe la petición, pide datos al modelo y elige la vista correcta.
const Producto = require('../models/Producto');

// Este método toma la lista de productos y la manda a la vista del catálogo.
exports.listar = async (req, res, next) => {
  try {
    // Pide todos los productos al modelo para mostrarlos en la página.
    const productos = await Producto.obtenerTodos();
    res.render('catalogo/catalogo', { productos });
  } catch (err) {
    // Si algo falla, el error pasa al manejador de errores de app.js (muestra views/errores/error.ejs).
    next(err);
  }
};

// Ficha de detalle de un producto (HU-016). Si no existe o está desactivado, muestra "no encontrado".
exports.detalle = async (req, res, next) => {
  try {
    const producto = await Producto.obtenerPorId(Number(req.params.id));
    if (!producto) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Este producto no existe o ya no está disponible.' });
    }
    res.render('catalogo/producto', { producto });
  } catch (err) {
    next(err);   // lo atiende el manejador de errores de app.js
  }
};
