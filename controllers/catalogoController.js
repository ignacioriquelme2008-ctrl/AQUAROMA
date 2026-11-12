
const Producto = require('../models/Producto');
const ventas = require('../config/ventas');



function seleccion(valor) {
  const lista = (Array.isArray(valor) ? valor : [valor])
    .filter((v) => typeof v === 'string' && v.trim() !== '');
  const reales = lista.filter((v) => v !== 'todos');
  return reales.length > 0 ? reales : [];
}



exports.listar = async (req, res, next) => {
  try {
    const aromasSel = seleccion(req.query.aroma);
    const tiposSel = seleccion(req.query.tipo);


    const [todos, tipos] = await Promise.all([
      Producto.obtenerTodos(),
      Producto.tiposConProductos(),
    ]);



    const aromas = [...new Map(todos.map((p) => [p.aromaSlug, p.aroma])).entries()]
      .map(([slug, nombre]) => ({ slug, nombre }));

    const productos = todos.filter((p) =>
      (aromasSel.length === 0 || aromasSel.includes(p.aromaSlug)) &&
      (tiposSel.length === 0 || tiposSel.includes(p.tipoSlug)));

    res.set('Cache-Control', 'no-store');
    res.render('catalogo/catalogo', {
      productos,
      aromas,
      tipos,
      filtros: { aromas: aromasSel, tipos: tiposSel },
      volver: req.originalUrl,
    });
  } catch (err) {

    next(err);
  }
};


exports.detalle = async (req, res, next) => {
  try {
    const producto = await Producto.obtenerPorId(Number(req.params.id));
    if (!producto) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Este producto no existe o ya no está disponible.' });
    }
    const aromas = producto.personalizable ? await Producto.aromasDisponibles() : [];
    const normalizarNombre = nombre => String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const aromaPredeterminado = aromas.find(aroma => normalizarNombre(aroma.nombre) === normalizarNombre(producto.aroma))?.id;
    res.render('catalogo/producto', { producto, aromas, aromaPredeterminado, ventas, volver: req.originalUrl });
  } catch (err) {
    next(err);
  }
};
