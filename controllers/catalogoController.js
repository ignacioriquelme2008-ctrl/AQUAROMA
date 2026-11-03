// Controlador de la sección CATÁLOGO: recibe la petición, pide datos al modelo y elige la vista correcta.
const Producto = require('../models/Producto');
const ventas = require('../config/ventas');

// Lee un filtro de la URL (?aroma=limon&tipo=sin-gas). "todos" y los valores vacíos no filtran.
// Si viene "todos" junto con un valor real, manda el valor real.
function seleccion(valor) {
  const lista = (Array.isArray(valor) ? valor : [valor])
    .filter((v) => typeof v === 'string' && v.trim() !== '');
  const reales = lista.filter((v) => v !== 'todos');
  return reales.length > 0 ? reales : [];
}

// Este método toma la lista de productos, aplica los filtros y la manda a la vista del catálogo.
// HU-014 (aroma) y HU-015 (tipo de agua): el filtrado lo decide el controlador, no el navegador.
exports.listar = async (req, res, next) => {
  try {
    const aromasSel = seleccion(req.query.aroma);
    const tiposSel = seleccion(req.query.tipo);

    // Pide todos los productos y los tipos de agua del filtro al modelo.
    const [todos, tipos] = await Promise.all([
      Producto.obtenerTodos(),
      Producto.tiposConProductos(),
    ]);

    // Las opciones del filtro salen de TODOS los productos activos, para que sigan visibles
    // aunque el filtro actual deje la lista vacía.
    const aromas = [...new Map(todos.map((p) => [p.aromaSlug, p.aroma])).entries()]
      .map(([slug, nombre]) => ({ slug, nombre }));

    const productos = todos.filter((p) =>
      (aromasSel.length === 0 || aromasSel.includes(p.aromaSlug)) &&
      (tiposSel.length === 0 || tiposSel.includes(p.tipoSlug)));

    res.render('catalogo/catalogo', {
      productos,
      aromas,
      tipos,
      filtros: { aromas: aromasSel, tipos: tiposSel },
      volver: req.originalUrl,
    });
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
    const aromas = producto.personalizable ? await Producto.aromasDisponibles() : [];
    res.render('catalogo/producto', { producto, aromas, ventas, volver: req.originalUrl });
  } catch (err) {
    next(err);   // lo atiende el manejador de errores de app.js
  }
};
