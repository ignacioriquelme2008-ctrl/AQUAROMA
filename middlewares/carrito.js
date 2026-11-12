






const Carrito = require('../models/Carrito');
const { normalizarItems } = require('../utils/carrito');


const contarEnSesion = (items) => normalizarItems(items).reduce((suma, i) => suma + i.qty, 0);

async function cargarCarrito(req, res, next) {
  const idCliente = req.session.usuario && req.session.usuario.idCliente;
  let cantidad = 0;

  try {
    cantidad = idCliente ? await Carrito.contar(idCliente) : contarEnSesion(req.session.carrito);
  } catch (err) {

    console.error('No se pudo contar el carrito:', err);
  }

  res.locals.carritoCantidad = cantidad;

  res.locals.avisoCarrito = req.session.avisoCarrito || null;
  delete req.session.avisoCarrito;
  next();
}

module.exports = { cargarCarrito };
