






const Pedido = require('../models/Pedido');
const notificarPedido = require('../utils/notificarPedido');
const ventas = require('../config/ventas');


exports.listar = (req, res) => {
  res.redirect('/perfil?seccion=pedidos');
};


exports.ver = async (req, res, next) => {
  try {

    const pedido = await Pedido.obtener(Number(req.params.id), { idCliente: req.session.usuario.idCliente });
    if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'No encontramos ese pedido en tu cuenta.' });



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


exports.cancelar = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const resultado = await Pedido.cancelarDeCliente(
      id,
      req.session.usuario.idCliente,
      req.session.usuario.id
    );
    const devolucion = resultado.solicitudReembolso ? '&devolucion=1' : '';
    void notificarPedido(id, 'cancelado');
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




exports.comprobante = async (req, res, next) => {
  try {

    const pedido = await Pedido.obtener(Number(req.params.id), { idCliente: req.session.usuario.idCliente });
    if (!pedido) return res.status(404).render('errores/no-encontrado', { mensaje: 'No encontramos ese pedido en tu cuenta.' });
    res.render('pedidos/comprobante', { pedido, nombres: Pedido.NOMBRES, ventas });
  } catch (err) {
    next(err);
  }
};
