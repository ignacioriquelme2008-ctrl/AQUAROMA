const test = require('node:test');
const assert = require('node:assert/strict');
const { buscarSucursalConStock } = require('../utils/stockVenta');

const inventario = (filas) => ({
  query: async (sql, params) => {
    assert.match(sql, /s\.activo = TRUE/);
    assert.match(sql, /FOR UPDATE/);
    assert.deepEqual(params[0], [...params[0]].sort((a, b) => a - b));
    return [filas];
  },
});

test('Limón sin existencias en Santiago se despacha desde Providencia', async () => {
  const conn = inventario([
    { id_producto: 2, id_sucursal: 1, cantidad: '0.000' },
    { id_producto: 2, id_sucursal: 2, cantidad: '10.000' },
  ]);
  assert.equal(await buscarSucursalConStock(conn, [{ id_producto: 2, cantidad: 1 }], 1), 2);
  assert.equal(await buscarSucursalConStock(conn, [{ id_producto: 2, cantidad: 11 }], 1), null);
});

test('las preparaciones del mismo producto comparten el stock', async () => {
  const conn = inventario([{ id_producto: 2, id_sucursal: 2, cantidad: 10 }]);
  assert.equal(await buscarSucursalConStock(conn, [
    { id_producto: 2, cantidad: 6 }, { id_producto: 2, cantidad: 5 },
  ]), null);
});

test('una sola sucursal debe disponer de todo el pedido', async () => {
  const conn = inventario([
    { id_producto: 2, id_sucursal: 1, cantidad: 3 },
    { id_producto: 3, id_sucursal: 2, cantidad: 4 },
  ]);
  assert.equal(await buscarSucursalConStock(conn, [
    { id_producto: 3, cantidad: 1 }, { id_producto: 2, cantidad: 1 },
  ]), null);
});

test('conserva la sucursal asignada cuando puede atender el pedido', async () => {
  const conn = inventario([
    { id_producto: 2, id_sucursal: 1, cantidad: 10 },
    { id_producto: 2, id_sucursal: 2, cantidad: 10 },
  ]);
  assert.equal(await buscarSucursalConStock(conn, [{ id_producto: 2, cantidad: 2 }], 2), 2);
});

test('no cuenta fracciones de botella como unidades disponibles', async () => {
  const conn = inventario([{ id_producto: 2, id_sucursal: 1, cantidad: '.500' }]);
  assert.equal(await buscarSucursalConStock(conn, [{ id_producto: 2, cantidad: 1 }]), null);
});
