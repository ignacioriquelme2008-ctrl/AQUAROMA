const crypto = require('crypto');
const paypal = require('../config/paypal');
const Checkout = require('../models/PaypalCheckout');

exports.configuracionPublica = paypal.configuracionPublica;

function error(message, status) { return Object.assign(new Error(message), { status }); }
function proteger(req, res, next) {
  if (!paypal.configuracionPublica().enabled) return res.status(503).json({ error: 'PayPal Sandbox está deshabilitado.' });
  if (!req.session.usuario?.idCliente) return res.status(401).json({ error: 'Inicia sesión para pagar tu pedido.' });
  if (!/^\d+$/.test(req.params.idPedido)) return res.status(400).json({ error: 'Pedido inválido.' });
  next();
}
const requestId = (operacion, id) => crypto.createHash('sha256')
  .update(`${process.env.PAYPAL_CLIENT_ID}:${operacion}:${id}`).digest('hex').slice(0, 38);

async function procesar(req, res, capturar) {
  try {
    const resultado = await Checkout.transaccion(async (conn) => {
      const pago = await Checkout.obtener(req.params.idPedido, req.session.usuario.idCliente, conn, true);
      if (!pago) throw error('No encontramos ese pago en tu cuenta.', 404);
      if (pago.pago_estado === 'aprobado') return { completed: true, redirect: `/pedidos/${pago.id_pedido}/comprobante` };
      if (pago.pedido_estado !== 'confirmado' || pago.pago_estado !== 'pendiente') {
        throw error('El pedido ya no está disponible para pagar.', 409);
      }
      if (!capturar) {
        if (pago.order_id) return { id: pago.order_id };
        const order = await paypal.request('/v2/checkout/orders', 'POST', {
          intent: 'CAPTURE', purchase_units: [{
            custom_id: `AQUAROMA-SANDBOX-${pago.id_pedido}`,
            description: `AQUAROMA pedido #${pago.id_pedido} (Sandbox)`,
            amount: { currency_code: 'USD', value: Number(pago.monto_usd).toFixed(2) },
          }], application_context: { brand_name: 'AQUAROMA (Sandbox)', landing_page: 'LOGIN', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' },
        }, requestId('crear', pago.id_pago));
        if (!order.id || order.status !== 'CREATED') throw error('No se pudo crear la orden PayPal.', 502);
        await conn.query('UPDATE paypal_checkout SET order_id = ? WHERE id_pago = ?', [order.id, pago.id_pago]);
        return { id: order.id };
      }
      if (!pago.order_id || req.body.orderID !== pago.order_id) throw error('La orden PayPal no corresponde a este pedido.', 400);
      const path = `/v2/checkout/orders/${encodeURIComponent(pago.order_id)}`;
      let order = await paypal.request(path);
      const unit = order.purchase_units?.[0];
      if (order.id !== pago.order_id || order.purchase_units?.length !== 1
          || unit?.custom_id !== `AQUAROMA-SANDBOX-${pago.id_pedido}`
          || unit?.amount?.currency_code !== 'USD' || Number(unit.amount.value) !== Number(pago.monto_usd)) {
        throw error('El importe o la referencia de PayPal no coincide con el pedido.', 409);
      }
      // GET recupera una captura completada aunque se haya perdido la respuesta anterior.
      if (order.status !== 'COMPLETED') {
        order = await paypal.request(`${path}/capture`, 'POST', {}, requestId('capturar', pago.id_pago));
      }
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (order.status !== 'COMPLETED' || capture?.status !== 'COMPLETED' || !capture.id
          || capture.amount?.currency_code !== 'USD' || Number(capture.amount.value) !== Number(pago.monto_usd)) {
        throw error('PayPal aún no confirmó el pago completo. Puedes volver a comprobarlo.', 409);
      }
      await conn.query('UPDATE paypal_checkout SET capture_id = ? WHERE id_pago = ?', [capture.id, pago.id_pago]);
      await conn.query("UPDATE pago SET estado = 'aprobado', referencia_externa = ?, fecha_pago = NOW() WHERE id_pago = ?",
        [`SBX-${capture.id}`, pago.id_pago]);
      await conn.query("UPDATE pedido SET estado = 'pagado', observacion = CONCAT(COALESCE(observacion, ''), ' | Pagado en PayPal Sandbox: dinero ficticio') WHERE id_pedido = ?",
        [pago.id_pedido]);
      return { completed: true, redirect: `/pedidos/${pago.id_pedido}/comprobante` };
    });
    res.json(resultado);
  } catch (err) {
    console.warn('PayPal checkout:', err.message);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'No se pudo completar la conexión con PayPal. Vuelve a intentar.' });
  }
}
exports.crearOrden = [proteger, (req, res) => procesar(req, res, false)];
exports.capturarOrden = [proteger, (req, res) => procesar(req, res, true)];
