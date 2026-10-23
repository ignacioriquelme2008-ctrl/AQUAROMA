// Modelo: stock de productos por sucursal (HU-038) y alertas de stock bajo (HU-039).
//
// El stock está en la tabla "inventario": una fila por producto y sucursal, con su cantidad y su
// stock_minimo (umbral de alerta). Cada ajuste deja una fila en "movimiento_inventario" con el
// usuario que lo hizo y el motivo, así el stock nunca cambia sin explicación.
// El catálogo suma el stock de todas las sucursales al mostrar cada producto (models/Producto.js),
// por eso un ajuste se ve en la tienda apenas se guarda (criterio 4 de HU-038, criterio 3 de HU-017).
const db = require('../config/db');

// Sucursales activas, en orden (Santiago, Providencia, ...). Son las columnas de la vista de stock.
exports.sucursales = async () => {
  const [filas] = await db.query('SELECT id_sucursal AS id, nombre FROM sucursal WHERE activo = TRUE ORDER BY id_sucursal');
  return filas;
};

// Stock de cada producto en cada sucursal.
// Devuelve [{ id, sku, nombre, activo, total, bajo, sucursales: { idSucursal: { cantidad, minimo, bajo } } }].
// Si un producto no tiene fila en una sucursal, no se lleva ahí y no cuenta como alerta.
// "bajo" = alguna sucursal en o bajo su mínimo: con eso el controlador arma el filtro de HU-039.
exports.listar = async () => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.sku, p.nombre, p.activo, i.id_sucursal, i.cantidad, i.stock_minimo
     FROM producto p
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     ORDER BY p.activo DESC, p.nombre`
  );

  const productos = new Map();
  for (const f of filas) {
    if (!productos.has(f.id)) {
      productos.set(f.id, { id: f.id, sku: f.sku, nombre: f.nombre, activo: Boolean(f.activo), total: 0, bajo: false, sucursales: {} });
    }
    if (f.id_sucursal === null) continue;   // producto sin stock cargado en ninguna sucursal
    const p = productos.get(f.id);
    const cantidad = Number(f.cantidad);
    const minimo = Number(f.stock_minimo);
    const bajo = p.activo && cantidad <= minimo;   // un producto inactivo no se vende: no se alerta
    p.sucursales[f.id_sucursal] = { cantidad, minimo, bajo };
    p.total += cantidad;
    if (bajo) p.bajo = true;
  }

  return [...productos.values()];
};

// Cantidad de alertas de stock crítico: productos activos con alguna sucursal en o bajo su mínimo.
// La muestra el panel de administración (criterio 2 de HU-039).
exports.contarStockBajo = async () => {
  const [filas] = await db.query(
    `SELECT COUNT(DISTINCT i.id_producto) AS n
     FROM inventario i JOIN producto p ON p.id_producto = i.id_producto
     WHERE p.activo = TRUE AND i.id_producto IS NOT NULL AND i.cantidad <= i.stock_minimo`
  );
  return Number(filas[0].n);
};

// Últimos movimientos de stock de productos, con quién los hizo (para revisar los ajustes).
exports.movimientosRecientes = async (limite = 10) => {
  const [filas] = await db.query(
    `SELECT m.fecha, m.tipo, m.cantidad, m.observacion, p.nombre AS producto, s.nombre AS sucursal, u.correo AS usuario
     FROM movimiento_inventario m
     JOIN producto p ON p.id_producto = m.id_producto
     JOIN sucursal s ON s.id_sucursal = m.id_sucursal
     JOIN usuario u ON u.id_usuario = m.id_usuario
     ORDER BY m.id_movimiento DESC
     LIMIT ?`,
    [limite]
  );
  return filas.map((f) => ({ ...f, cantidad: Number(f.cantidad) }));
};

// Error que el controlador muestra junto al campo "Cambio" (criterio 3 de HU-038).
class StockNegativoError extends Error {
  constructor(actual, cambio) {
    super(`El ajuste dejaría el stock en ${actual + cambio} unidades: hay ${actual} y no puede quedar negativo.`);
    this.code = 'STOCK_NEGATIVO';
  }
}
exports.StockNegativoError = StockNegativoError;

// Suma (cambio > 0) o resta (cambio < 0) unidades de un producto en una sucursal.
// Todo va en una transacción y la fila queda bloqueada (FOR UPDATE) mientras se calcula, para que
// dos ajustes al mismo tiempo no se pisen. Si el resultado sería negativo, no se guarda nada.
// El movimiento queda como "ajuste" si suma o "merma" si resta (la columna cantidad siempre es positiva),
// con el motivo y el antes/después en la observación.
exports.ajustar = async ({ idProducto, idSucursal, cambio, motivo, idUsuario }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [filas] = await conn.query(
      'SELECT cantidad FROM inventario WHERE id_sucursal = ? AND id_producto = ? FOR UPDATE',
      [idSucursal, idProducto]
    );
    const actual = filas[0] ? Number(filas[0].cantidad) : 0;
    const nuevo = actual + cambio;
    if (nuevo < 0) throw new StockNegativoError(actual, cambio);

    if (filas[0]) {
      await conn.query('UPDATE inventario SET cantidad = ? WHERE id_sucursal = ? AND id_producto = ?', [nuevo, idSucursal, idProducto]);
    } else {
      await conn.query('INSERT INTO inventario (id_sucursal, id_producto, cantidad) VALUES (?, ?, ?)', [idSucursal, idProducto, nuevo]);
    }
    await conn.query(
      `INSERT INTO movimiento_inventario (id_sucursal, id_producto, tipo, cantidad, tipo_origen, id_usuario, observacion)
       VALUES (?, ?, ?, ?, 'ajuste_manual', ?, ?)`,
      [idSucursal, idProducto, cambio > 0 ? 'ajuste' : 'merma', Math.abs(cambio), idUsuario,
       `${motivo} (de ${actual} a ${nuevo} unidades)`]
    );
    await conn.commit();
    return { actual, nuevo };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Cambia el umbral de alerta (stock_minimo) de un producto en una sucursal (HU-039).
// Si el producto todavía no tiene fila en esa sucursal, se crea con 0 unidades.
exports.cambiarMinimo = async ({ idProducto, idSucursal, minimo }) => {
  await db.query(
    `INSERT INTO inventario (id_sucursal, id_producto, cantidad, stock_minimo) VALUES (?, ?, 0, ?)
     ON DUPLICATE KEY UPDATE stock_minimo = VALUES(stock_minimo)`,
    [idSucursal, idProducto, minimo]
  );
};
