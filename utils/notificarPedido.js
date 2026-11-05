const Pedido = require('../models/Pedido');
const correo = require('../config/correo');

// La notificación se intenta después de guardar el pedido y no interrumpe el flujo si falla SMTP.
module.exports = async (id, estado, despacho) => {
  if (!correo.configurado()) return;
  try {
    const pedido = await Pedido.obtener(id);
    if (!pedido) return;
    if (estado === 'confirmado') await correo.enviarConfirmacionPedido(pedido);
    else await correo.enviarEstadoPedido(pedido, estado, despacho);
  } catch (err) {
    console.warn(`No se pudo enviar el aviso de pedido #${id} (${estado}).`, err.code || '');
  }
};
