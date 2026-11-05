// Controlador de STOCK POR SUCURSAL del panel de administración.
//   HU-038: ver el stock de cada sucursal y ajustarlo con un motivo (queda registrado quién lo hizo).
//   HU-039: stock mínimo por producto y sucursal, productos en alerta y filtro "Ver solo stock bajo".
// Las rutas están en routes/adminRoutes.js y exigen el permiso "gestionar_stock".
const Inventario = require('../models/Inventario');
const { texto } = require('../utils/validaciones');

const CAMBIO_MAX = 99999;      // unidades que se pueden sumar o restar de una vez
const MINIMO_MAX = 99999;
const LARGO_MOTIVO = 200;

// Convierte "-5", "+10" o "10" en número entero. Devuelve NaN si no es un entero.
function entero(valor) {
  const limpio = texto(valor).trim().replace(/^\+/, '');
  return /^-?\d+$/.test(limpio) ? Number(limpio) : NaN;
}

// Arma todo lo que necesita la vista y la muestra. "formulario" guarda lo escrito si hubo errores.
async function mostrar(req, res, estado = 200, formulario = {}) {
  const soloBajo = req.query.bajo === '1';
  const [todos, sucursales, movimientos, totalBajo] = await Promise.all([
    Inventario.listar(),
    Inventario.sucursales(),
    Inventario.movimientosRecientes(10),
    Inventario.contarStockBajo(),
  ]);
  // La tabla puede venir filtrada; las listas desplegables de los formularios usan todos los productos.
  const productos = soloBajo ? todos.filter((p) => p.bajo) : todos;
  const sucursalElegida = sucursales.find(s => s.id === Number(req.query.sucursal));
  const productoElegido = todos.find(p => p.id === Number(req.query.producto));
  const datosIniciales = {
    ...(sucursalElegida ? { idSucursal: String(sucursalElegida.id) } : {}),
    ...(productoElegido ? { idProducto: String(productoElegido.id) } : {}),
  };
  // Aviso de éxito después de guardar (?ajustado=1 o ?minimo=1).
  const exito = req.query.ajustado ? 'Ajuste guardado. El catálogo ya muestra el stock nuevo.'
    : req.query.minimo ? 'Stock mínimo actualizado.' : null;
  res.status(estado).render('admin/stock', {
    productos, todos, sucursales, movimientos, totalBajo, soloBajo, exito,
    ajuste: formulario.ajuste || { datos: { ...datosIniciales }, errores: {} },
    minimo: formulario.minimo || { datos: { ...datosIniciales }, errores: {} },
  });
}

// GET /admin/stock (y /admin/stock?bajo=1 para ver solo los productos con stock bajo).
exports.ver = async (req, res, next) => {
  try {
    await mostrar(req, res);
  } catch (err) {
    next(err);
  }
};

// Revisa que el producto y la sucursal existan en la lista (nadie puede mandar un id inventado).
async function validarProductoYSucursal(body, errores) {
  const [productos, sucursales] = await Promise.all([Inventario.listar(), Inventario.sucursales()]);
  const idProducto = Number(body.idProducto);
  const idSucursal = Number(body.idSucursal);
  if (!productos.some((p) => p.id === idProducto)) errores.idProducto = 'Elige el producto.';
  if (!sucursales.some((s) => s.id === idSucursal)) errores.idSucursal = 'Elige la sucursal.';
  return { idProducto, idSucursal };
}

// POST /admin/stock/ajuste -> suma o resta unidades (criterios 2 y 3 de HU-038).
exports.ajustar = async (req, res, next) => {
  const datos = {
    idProducto: texto(req.body.idProducto),
    idSucursal: texto(req.body.idSucursal),
    cambio: texto(req.body.cambio).trim(),
    motivo: texto(req.body.motivo).trim(),
  };
  const errores = {};
  try {
    const { idProducto, idSucursal } = await validarProductoYSucursal(req.body, errores);
    const cambio = entero(datos.cambio);
    if (!datos.cambio) errores.cambio = 'Ingresa cuántas unidades sumar (ej.: 10) o restar (ej.: -3).';
    else if (Number.isNaN(cambio)) errores.cambio = 'Debe ser un número entero, por ejemplo 10 o -3.';
    else if (cambio === 0) errores.cambio = 'El cambio no puede ser 0.';
    else if (Math.abs(cambio) > CAMBIO_MAX) errores.cambio = `Puedes ajustar hasta ${CAMBIO_MAX} unidades de una vez.`;
    // Criterio 2 de HU-038: el ajuste exige una justificación.
    if (!datos.motivo) errores.motivo = 'Escribe el motivo del ajuste (ej.: reposición, conteo físico, botellas dañadas).';
    else if (datos.motivo.length > LARGO_MOTIVO) errores.motivo = `El motivo puede tener hasta ${LARGO_MOTIVO} caracteres.`;

    if (Object.keys(errores).length > 0) return await mostrar(req, res, 400, { ajuste: { datos, errores } });

    await Inventario.ajustar({ idProducto, idSucursal, cambio, motivo: datos.motivo, idUsuario: req.session.usuario.id });
    res.redirect('/admin/stock?ajustado=1&sucursal=' + idSucursal);
  } catch (err) {
    // Criterio 3 de HU-038: si el stock quedaría negativo, no se guarda y se avisa.
    if (err.code === 'STOCK_NEGATIVO') {
      try {
        return await mostrar(req, res, 400, { ajuste: { datos, errores: { cambio: err.message } } });
      } catch (e) {
        return next(e);
      }
    }
    next(err);
  }
};

// POST /admin/stock/minimo -> cambia el umbral de alerta de un producto en una sucursal (HU-039).
exports.cambiarMinimo = async (req, res, next) => {
  const datos = {
    idProducto: texto(req.body.idProducto),
    idSucursal: texto(req.body.idSucursal),
    minimo: texto(req.body.minimo).trim(),
  };
  const errores = {};
  try {
    const { idProducto, idSucursal } = await validarProductoYSucursal(req.body, errores);
    const minimo = entero(datos.minimo);
    if (!datos.minimo) errores.minimo = 'Ingresa el stock mínimo.';
    else if (Number.isNaN(minimo) || minimo < 0) errores.minimo = 'Debe ser un número entero de 0 o más.';
    else if (minimo > MINIMO_MAX) errores.minimo = `El mínimo puede ser hasta ${MINIMO_MAX}.`;

    if (Object.keys(errores).length > 0) return await mostrar(req, res, 400, { minimo: { datos, errores } });

    await Inventario.cambiarMinimo({ idProducto, idSucursal, minimo });
    res.redirect('/admin/stock?minimo=1&sucursal=' + idSucursal);
  } catch (err) {
    next(err);
  }
};
