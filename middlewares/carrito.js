// Middleware del carrito: deja listo el contador del menú en TODAS las páginas (HU-022) y
// muestra el aviso de la última acción ("se agregó al carrito", "solo quedan X unidades").
//
// El carrito ya no vive en el navegador:
//   - Visitante: se guarda en req.session.carrito (Express).
//   - Cliente con sesión (HU-026): se guarda en MySQL, en su cuenta.
// Así el controlador es el único que decide y la vista solo dibuja.
const Carrito = require('../models/Carrito');
const { normalizarItems } = require('../utils/carrito');

// Unidades totales de un carrito guardado en la sesión.
const contarEnSesion = (items) => normalizarItems(items).reduce((suma, i) => suma + i.qty, 0);

async function cargarCarrito(req, res, next) {
  const idCliente = req.session.usuario && req.session.usuario.idCliente;
  let cantidad = 0;

  try {
    cantidad = idCliente ? await Carrito.contar(idCliente) : contarEnSesion(req.session.carrito);
  } catch (err) {
    // Si falla el conteo, la página igual se muestra (el carrito se valida de nuevo al abrirlo).
    console.error('No se pudo contar el carrito:', err);
  }

  res.locals.carritoCantidad = cantidad;
  // El aviso se muestra una sola vez: se borra de la sesión al entregarlo a la vista.
  res.locals.avisoCarrito = req.session.avisoCarrito || null;
  delete req.session.avisoCarrito;
  next();
}

module.exports = { cargarCarrito };
