



const Inventario = require('../models/Inventario');
const { texto } = require('../utils/validaciones');

const CAMBIO_MAX = 99999;
const MINIMO_MAX = 99999;
const LARGO_MOTIVO = 200;


function entero(valor) {
  const limpio = texto(valor).trim().replace(/^\+/, '');
  return /^-?\d+$/.test(limpio) ? Number(limpio) : NaN;
}


async function mostrar(req, res, estado = 200, formulario = {}) {
  const soloBajo = req.query.bajo === '1';
  const [todos, sucursales, movimientos, totalBajo] = await Promise.all([
    Inventario.listar(),
    Inventario.sucursales(),
    Inventario.movimientosRecientes(10),
    Inventario.contarStockBajo(),
  ]);

  const productos = soloBajo ? todos.filter((p) => p.bajo) : todos;
  const sucursalElegida = sucursales.find(s => s.id === Number(req.query.sucursal));
  const productoElegido = todos.find(p => p.id === Number(req.query.producto));
  const datosIniciales = {
    ...(sucursalElegida ? { idSucursal: String(sucursalElegida.id) } : {}),
    ...(productoElegido ? { idProducto: String(productoElegido.id) } : {}),
  };

  const exito = req.query.ajustado ? 'Ajuste guardado. El catálogo ya muestra el stock nuevo.'
    : req.query.minimo ? 'Stock mínimo actualizado.' : null;
  res.status(estado).render('admin/stock', {
    productos, todos, sucursales, movimientos, totalBajo, soloBajo, exito,
    ajuste: formulario.ajuste || { datos: { ...datosIniciales }, errores: {} },
    minimo: formulario.minimo || { datos: { ...datosIniciales }, errores: {} },
  });
}


exports.ver = async (req, res, next) => {
  try {
    await mostrar(req, res);
  } catch (err) {
    next(err);
  }
};


async function validarProductoYSucursal(body, errores) {
  const [productos, sucursales] = await Promise.all([Inventario.listar(), Inventario.sucursales()]);
  const idProducto = Number(body.idProducto);
  const idSucursal = Number(body.idSucursal);
  if (!productos.some((p) => p.id === idProducto)) errores.idProducto = 'Elige el producto.';
  if (!sucursales.some((s) => s.id === idSucursal)) errores.idSucursal = 'Elige la sucursal.';
  return { idProducto, idSucursal };
}


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

    if (!datos.motivo) errores.motivo = 'Escribe el motivo del ajuste (ej.: reposición, conteo físico, botellas dañadas).';
    else if (datos.motivo.length > LARGO_MOTIVO) errores.motivo = `El motivo puede tener hasta ${LARGO_MOTIVO} caracteres.`;

    if (Object.keys(errores).length > 0) return await mostrar(req, res, 400, { ajuste: { datos, errores } });

    await Inventario.ajustar({ idProducto, idSucursal, cambio, motivo: datos.motivo, idUsuario: req.session.usuario.id });
    res.redirect('/admin/stock?ajustado=1&sucursal=' + idSucursal);
  } catch (err) {

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
