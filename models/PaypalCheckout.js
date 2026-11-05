const db = require('../config/db');

exports.obtener = async (idPedido, idCliente, conn = db, bloquear = false) => {
  const [[fila]] = await conn.query(
    `SELECT pe.id_pedido, pe.estado AS pedido_estado, pa.id_pago, pa.estado AS pago_estado,
            pa.monto, pc.monto_usd, pc.tasa_clp, pc.fecha_tasa, pc.order_id, pc.capture_id
     FROM pedido pe JOIN pago pa ON pa.id_pedido = pe.id_pedido
     JOIN paypal_checkout pc ON pc.id_pago = pa.id_pago
     WHERE pe.id_pedido = ? AND pe.id_cliente = ? ${bloquear ? 'FOR UPDATE' : ''}`,
    [idPedido, idCliente]
  );
  return fila || null;
};

exports.transaccion = async (trabajo) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await trabajo(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
};
