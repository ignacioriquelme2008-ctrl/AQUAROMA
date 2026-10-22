// Controlador de la sección CARRITO.
// La página /carrito la arma el navegador (views/carrito/carrito.ejs + public/js/carrito-pagina.js).
// Las rutas /carrito/api las usa public/js/carrito.js para guardar el carrito en la cuenta (HU-026).
const Carrito = require('../models/Carrito');

// Máximo de productos distintos que se aceptan en una petición (evita listas gigantes).
const MAX_PRODUCTOS = 100;

exports.ver = (req, res) => {
  res.render('carrito/carrito');
};

// Revisa la lista que manda el navegador: [{ id, qty }]. Nunca se confía en ella tal cual:
// se descartan los datos inválidos, se juntan los ids repetidos y se aplica el tope de unidades.
// El nombre y el precio NO se reciben del navegador: el modelo los saca de la base.
function limpiarItems(lista) {
  if (!Array.isArray(lista)) return null;
  const cantidades = new Map();
  for (const item of lista.slice(0, MAX_PRODUCTOS)) {
    const id = Number(item && item.id);
    const qty = Math.floor(Number(item && item.qty));
    if (!Number.isInteger(id) || id <= 0 || !(qty >= 1)) continue;
    cantidades.set(id, Math.min((cantidades.get(id) || 0) + qty, Carrito.MAX_CANTIDAD));
  }
  return [...cantidades].map(([id, qty]) => ({ id, qty }));
}

// GET /carrito/api -> el carrito guardado en la cuenta.
exports.obtener = async (req, res) => {
  try {
    res.json({ items: await Carrito.obtener(req.session.usuario.idCliente) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo cargar el carrito.' });
  }
};

// PUT /carrito/api -> reemplaza el carrito guardado por el que manda el navegador.
exports.guardar = async (req, res) => {
  const items = limpiarItems(req.body && req.body.items);
  if (!items) return res.status(400).json({ error: 'Formato de carrito inválido.' });
  try {
    res.json({ items: await Carrito.guardar(req.session.usuario.idCliente, items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el carrito.' });
  }
};

// POST /carrito/api/fusionar -> suma el carrito de visitante al de la cuenta (justo después del login).
exports.fusionar = async (req, res) => {
  const items = limpiarItems(req.body && req.body.items);
  if (!items) return res.status(400).json({ error: 'Formato de carrito inválido.' });
  try {
    res.json({ items: await Carrito.fusionar(req.session.usuario.idCliente, items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo unir el carrito.' });
  }
};
