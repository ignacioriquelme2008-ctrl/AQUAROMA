const test = require('node:test');
const assert = require('node:assert/strict');
const cambio = require('../config/tipoCambio');
const checkout = require('../models/PaypalCheckout');
const paypal = require('../config/paypal');
const controller = require('../controllers/paypalSandboxController');

function pago() { return { id_pedido: 42, id_pago: 8, pedido_estado: 'confirmado', pago_estado: 'pendiente', monto_usd: '10.22', order_id: 'ORDER123456' }; }
function orden() { return { id: 'ORDER123456', status: 'APPROVED', purchase_units: [{ custom_id: 'AQUAROMA-SANDBOX-42', amount: { currency_code: 'USD', value: '10.22' } }] }; }
async function ejecutar(fila, respuestas, body = { orderID: 'ORDER123456' }, capturar = true) {
  const consultas = []; const llamadas = [];
  const originales = [checkout.obtener, checkout.transaccion, paypal.request];
  checkout.obtener = async () => fila;
  checkout.transaccion = async f => f({ query: async (...args) => { consultas.push(args); return [{}]; } });
  paypal.request = async (...args) => { llamadas.push(args); const r = respuestas.shift(); if (r instanceof Error) throw r; return r; };
  const req = { params: { idPedido: '42' }, session: { usuario: { idCliente: 3 } }, body };
  const res = { codigo: 200, status(n) { this.codigo = n; return this; }, json(d) { this.data = d; return this; } };
  try { await controller[capturar ? 'capturarOrden' : 'crearOrden'][1](req, res); }
  finally { [checkout.obtener, checkout.transaccion, paypal.request] = originales; }
  return { res, consultas, llamadas };
}

test('conversión con tasa completa y redondeo final', () => {
  assert.equal(cambio.convertir(10000, 978.112665), '10.22');
  assert.equal(cambio.convertir(1, 8), '0.13');
  assert.throws(() => cambio.convertir(0, 900));
  assert.throws(() => cambio.convertir(1000, Infinity));
});
test('rechaza pago ajeno sin llamar a PayPal', async () => {
  const r = await ejecutar(null, []); assert.equal(r.res.codigo, 404); assert.equal(r.llamadas.length, 0);
});
test('rechaza orden PayPal distinta sin captura', async () => {
  const r = await ejecutar(pago(), [], { orderID: 'OTRAORDEN' }); assert.equal(r.res.codigo, 400); assert.equal(r.llamadas.length, 0);
});
test('rechaza importe alterado antes de capturar', async () => {
  const o = orden(); o.purchase_units[0].amount.value = '1.00';
  const r = await ejecutar(pago(), [o]); assert.equal(r.res.codigo, 409); assert.equal(r.llamadas.length, 1); assert.equal(r.consultas.length, 0);
});
test('captura completa actualiza pago y pedido una sola vez', async () => {
  const o = orden(); const completa = orden(); completa.status = 'COMPLETED';
  completa.purchase_units[0].payments = { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { value: '10.22', currency_code: 'USD' } }] };
  const r = await ejecutar(pago(), [o, completa]);
  assert.equal(r.res.data.completed, true); assert.equal(r.consultas.length, 3);
  assert.equal(r.llamadas[1][3].length, 38); assert.match(r.consultas[1][0], /aprobado/);
});
test('recupera captura completada si se perdió la respuesta', async () => {
  const o = orden(); o.status = 'COMPLETED';
  o.purchase_units[0].payments = { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { value: '10.22', currency_code: 'USD' } }] };
  const r = await ejecutar(pago(), [o]); assert.equal(r.res.data.completed, true); assert.equal(r.llamadas.length, 1);
});
test('captura pendiente nunca marca el pedido pagado', async () => {
  const o = orden(); const completa = orden(); completa.status = 'COMPLETED';
  completa.purchase_units[0].payments = { captures: [{ id: 'CAPTURE123', status: 'PENDING', amount: { value: '10.22', currency_code: 'USD' } }] };
  const r = await ejecutar(pago(), [o, completa]); assert.equal(r.res.codigo, 409); assert.equal(r.consultas.length, 0);
});
test('reintento después de aprobar devuelve comprobante sin nueva captura', async () => {
  const r = await ejecutar({ ...pago(), pago_estado: 'aprobado' }, []);
  assert.equal(r.res.data.redirect, '/pedidos/42/comprobante'); assert.equal(r.llamadas.length, 0);
});
test('no permite pagar pedido cancelado', async () => {
  const r = await ejecutar({ ...pago(), pedido_estado: 'cancelado' }, []); assert.equal(r.res.codigo, 409); assert.equal(r.llamadas.length, 0);
});
test('reutiliza orden creada sin duplicarla', async () => {
  const r = await ejecutar(pago(), [], {}, false); assert.equal(r.res.data.id, 'ORDER123456'); assert.equal(r.llamadas.length, 0);
});

test('las nuevas órdenes prefieren iniciar sesión en PayPal', async () => {
  const r = await ejecutar({ ...pago(), order_id: null }, [{ id: 'NUEVAORDEN', status: 'CREATED' }], {}, false);
  assert.equal(r.res.data.id, 'NUEVAORDEN');
  assert.equal(r.llamadas[0][2].application_context.landing_page, 'LOGIN');
  assert.equal(r.llamadas[0][2].application_context.shipping_preference, 'NO_SHIPPING');
});
test('API exige sesión y modo sandbox', () => {
  const original = paypal.configuracionPublica;
  const res = { status(n) { this.codigo = n; return this; }, json() {} };
  try {
    paypal.configuracionPublica = () => ({ enabled: true });
    controller.crearOrden[0]({ session: {}, params: { idPedido: '42' } }, res, () => assert.fail());
    assert.equal(res.codigo, 401);
    paypal.configuracionPublica = () => ({ enabled: false });
    controller.crearOrden[0]({ session: {}, params: {} }, res, () => assert.fail()); assert.equal(res.codigo, 503);
  } finally { paypal.configuracionPublica = original; }
});
