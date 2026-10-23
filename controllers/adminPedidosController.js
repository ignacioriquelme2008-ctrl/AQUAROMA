// Controlador de PEDIDOS del panel de administración (HU-040).
//   listar: todos los pedidos, con filtro por estado (criterio 1).
//   ver: detalle de un pedido con los cambios de estado permitidos (criterio 2).
//   cambiarEstado: guarda el cambio; al pasar a "Enviado" exige transportista y seguimiento (criterio 3).
// Lo que se guarda aquí lo lee el seguimiento del cliente (HU-032) al abrir la página (criterio 4).
// Las rutas están en routes/adminRoutes.js y exigen el permiso "gestionar_pedidos".
const Pedido = require('../models/Pedido');
const { texto } = require('../utils/validaciones');

const LARGO = { transportista: 100, tracking: 100 };   // columnas envio.transportista y envio.tracking

// GET /admin/pedidos y /admin/pedidos?estado=pagado
exports.listar = async (req, res, next) => {
  try {
    const estado = Object.keys(Pedido.NOMBRES).includes(req.query.estado) ? req.query.estado : null;
    const [pedidos, conteo] = await Promise.all([Pedido.listarAdmin(estado), Pedido.contarPorEstado()]);
    res.render('admin/pedidos', { pedidos, conteo, estado, nombres: Pedido.NOMBRES });
  } catch (err) {
    next(err);
  }
};

// Muestra el detalle. "formulario" trae lo escrito y los errores si el cambio no se pudo guardar.
async function mostrarDetalle(req, res, estado = 200, formulario = { datos: {}, errores: {} }) {
  const pedido = await Pedido.obtener(Number(req.params.id));
  if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'Ese pedido no existe.' });
  res.status(estado).render('admin/pedido', {
    pedido,
    siguientes: Pedido.SIGUIENTES[pedido.estado] || [],
    nombres: Pedido.NOMBRES,
    exito: req.query.actualizado ? `El pedido quedó "${Pedido.NOMBRES[pedido.estado]}". El cliente ya lo ve en su seguimiento.` : null,
    formulario,
  });
}

// GET /admin/pedidos/:id
exports.ver = async (req, res, next) => {
  try {
    await mostrarDetalle(req, res);
  } catch (err) {
    next(err);
  }
};

// POST /admin/pedidos/:id/estado
exports.cambiarEstado = async (req, res, next) => {
  const datos = {
    estado: texto(req.body.estado),
    transportista: texto(req.body.transportista).trim(),
    tracking: texto(req.body.tracking).trim(),
  };
  const errores = {};
  if (!Pedido.NOMBRES[datos.estado]) errores.estado = 'Elige el nuevo estado.';
  if (datos.estado === 'enviado') {
    if (!datos.transportista) errores.transportista = 'Ingresa la empresa de transporte.';
    else if (datos.transportista.length > LARGO.transportista) errores.transportista = `Hasta ${LARGO.transportista} caracteres.`;
    if (!datos.tracking) errores.tracking = 'Ingresa el código de seguimiento.';
    else if (datos.tracking.length > LARGO.tracking) errores.tracking = `Hasta ${LARGO.tracking} caracteres.`;
  }
  try {
    if (Object.keys(errores).length > 0) return await mostrarDetalle(req, res, 400, { datos, errores });

    await Pedido.cambiarEstado(Number(req.params.id), datos.estado, datos.estado === 'enviado' ? datos : {});
    res.redirect(`/admin/pedidos/${Number(req.params.id)}?actualizado=1`);
  } catch (err) {
    // Criterio 2: un salto que no está en la secuencia se rechaza con un aviso.
    if (err.code === 'CAMBIO_INVALIDO') {
      try {
        return await mostrarDetalle(req, res, 400, { datos, errores: { estado: err.message } });
      } catch (e) {
        return next(e);
      }
    }
    next(err);
  }
};
