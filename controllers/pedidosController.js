// Controlador de la sección PEDIDOS del cliente.
//   listar: "Mis pedidos", la lista de compras del cliente.
//   ver: estado y seguimiento de un pedido (HU-032): barra de progreso, transporte y seguimiento,
//        aviso si está cancelado. Se lee de la base cada vez, así refleja al instante lo que cambie
//        el administrador en /admin/pedidos (HU-040).
//   comprobante: compra recién confirmada (HU-028): número de orden, ítems y montos.
// Solo entra un cliente con sesión (permiso "ver_mis_pedidos") y cada uno ve solo sus pedidos.
const Pedido = require('../models/Pedido');
const ventas = require('../config/ventas');

// GET /pedidos
exports.listar = (req, res) => {
  res.redirect('/perfil?seccion=pedidos');
};

// GET /pedidos/:id
exports.ver = async (req, res, next) => {
  try {
    // Con idCliente, el modelo solo devuelve el pedido si es de este cliente: el de otro da "no encontrado".
    const pedido = await Pedido.obtener(Number(req.params.id), { idCliente: req.session.usuario.idCliente });
    if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'No encontramos ese pedido en tu cuenta.' });

    // Barra de progreso: índice del paso actual (-1 si está cancelado). Un pedido entregado ya
    // terminó: todos sus pasos se marcan como cumplidos.
    const paso = pedido.estado === 'entregado' ? Pedido.ESTADOS.length : Pedido.ESTADOS.indexOf(pedido.estado);
    const avisoCancelacion = req.query.cancelado === '1'
      ? (req.query.devolucion === '1'
        ? 'Pedido cancelado. La solicitud de devolución quedó pendiente; no se ha ejecutado un reembolso.'
        : 'Tu pedido fue cancelado y las unidades volvieron al stock disponible.')
      : req.query.cancelacion === 'denegada'
        ? 'Este pedido ya salió a despacho o no se puede cancelar en su estado actual.'
        : null;
    res.render('pedidos/pedido', {
      pedido,
      pasos: Pedido.ESTADOS,
      paso,
      nombres: Pedido.NOMBRES,
      puedeCancelar: Pedido.ESTADOS_CANCELABLES.includes(pedido.estado),
      avisoCancelacion,
    });
  } catch (err) {
    next(err);
  }
};

// HU-034: solo el cliente dueño puede cancelar y el modelo bloquea pedido/stock en una transacción.
exports.cancelar = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const resultado = await Pedido.cancelarDeCliente(
      id,
      req.session.usuario.idCliente,
      req.session.usuario.id
    );
    const devolucion = resultado.solicitudReembolso ? '&devolucion=1' : '';
    return res.redirect(`/pedidos/${id}?cancelado=1${devolucion}`);
  } catch (err) {
    if (err.code === 'CAMBIO_INVALIDO') {
      try {
        const pedido = await Pedido.obtener(Number(req.params.id), { idCliente: req.session.usuario.idCliente });
        if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'No encontramos ese pedido en tu cuenta.' });
        return res.redirect(`/pedidos/${Number(req.params.id)}?cancelacion=denegada`);
      } catch (error) {
        return next(error);
      }
    }
    return next(err);
  }
};

// GET /pedidos/:id/comprobante
// HU-028: comprobante de la compra. Es la pantalla a la que llega el cliente apenas confirma
// (criterios 3) y puede volver a verla cuando quiera desde el seguimiento del pedido.
exports.comprobante = async (req, res, next) => {
  try {
    // Igual que ver(): el modelo solo devuelve el pedido si es de este cliente.
    const pedido = await Pedido.obtener(Number(req.params.id), { idCliente: req.session.usuario.idCliente });
    if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'No encontramos ese pedido en tu cuenta.' });
    res.render('pedidos/comprobante', { pedido, nombres: Pedido.NOMBRES, ventas });
  } catch (err) {
    next(err);
  }
};
