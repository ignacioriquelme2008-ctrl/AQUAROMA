// Un pedido sale de una sola sucursal: no se suman existencias de locales
// diferentes para prometer una cantidad que ninguno puede despachar.
const STOCK_POR_PRODUCTO = `
  SELECT i.id_producto, MAX(GREATEST(FLOOR(i.cantidad), 0)) AS stock
  FROM inventario i
  JOIN sucursal s ON s.id_sucursal = i.id_sucursal AND s.activo = TRUE
  WHERE i.id_producto IS NOT NULL
  GROUP BY i.id_producto`;

async function buscarSucursalConStock(conn, lineas, preferida = null) {
  const necesarias = new Map();
  for (const linea of lineas) {
    const id = Number(linea.id_producto);
    necesarias.set(id, (necesarias.get(id) || 0) + Number(linea.cantidad));
  }
  if (!necesarias.size) return null;
  // Bloquea en un orden estable y mantiene la reserva y el descuento dentro
  // de la transacción de confirmación, incluso con compras simultáneas.
  const [filas] = await conn.query(
    `SELECT i.id_sucursal, i.id_producto, i.cantidad
     FROM inventario i
     JOIN sucursal s ON s.id_sucursal = i.id_sucursal AND s.activo = TRUE
     WHERE i.id_producto IN (?)
     ORDER BY i.id_producto, i.id_sucursal
     FOR UPDATE`,
    [[...necesarias.keys()].sort((a, b) => a - b)]
  );
  const sucursales = new Map();
  for (const fila of filas) {
    const id = Number(fila.id_sucursal);
    if (!sucursales.has(id)) sucursales.set(id, new Map());
    sucursales.get(id).set(Number(fila.id_producto), Math.max(0, Math.floor(Number(fila.cantidad))));
  }
  const candidatas = [...sucursales.keys()].sort((a, b) => {
    if (a === Number(preferida)) return -1;
    if (b === Number(preferida)) return 1;
    return a - b;
  });
  return candidatas.find(id => [...necesarias].every(
    ([producto, cantidad]) => (sucursales.get(id).get(producto) || 0) >= cantidad
  )) || null;
}

module.exports = { STOCK_POR_PRODUCTO, buscarSucursalConStock };
