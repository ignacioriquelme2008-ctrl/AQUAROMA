// Modelo del carrito guardado en la cuenta del cliente (HU-026).
//
// No se creó una tabla nueva: se usa la estructura de pedidos que ya tenía la base.
//   - El carrito activo es un "pedido" del cliente con estado = 'carrito' (uno por cliente).
//   - Cada producto del carrito es una fila de "detalle_pedido". Esa fila no apunta directo al
//     producto, sino a su "configuración base" (configuracion_bebida con es_plantilla_global = TRUE),
//     igual que los pedidos de prueba de la HU-008.
//
// Cuando la HU-028 confirme una compra, basta con cambiar el estado de ese pedido a 'confirmado':
// el cliente queda sin pedido en estado 'carrito', es decir, con el carrito vacío (HU-026, criterio 3).
const db = require('../config/db');

// Tope de unidades por producto. Es el mismo de la página del carrito (public/js/carrito-pagina.js).
const MAX_CANTIDAD = 99;

// Busca el carrito activo del cliente y, si no tiene, lo crea. Se usa DENTRO de una transacción.
async function obtenerOCrearCarrito(conn, idCliente) {
  // "FOR UPDATE" bloquea la fila del cliente hasta que termine la transacción. Si llegan dos
  // peticiones al mismo tiempo, la segunda espera, y así nunca se crean dos carritos para un cliente.
  await conn.query('SELECT id_cliente FROM cliente WHERE id_cliente = ? FOR UPDATE', [idCliente]);

  const [filas] = await conn.query(
    `SELECT id_pedido FROM pedido
     WHERE id_cliente = ? AND estado = 'carrito'
     ORDER BY id_pedido DESC LIMIT 1`,
    [idCliente]
  );
  if (filas[0]) return filas[0].id_pedido;

  const [nuevo] = await conn.query(
    `INSERT INTO pedido (id_cliente, estado, total, costo_envio, observacion)
     VALUES (?, 'carrito', 0, 0, 'Carrito activo (HU-026)')`,
    [idCliente]
  );
  return nuevo.insertId;
}

// Devuelve el id de la configuración base de un producto. Si el producto todavía no tiene una
// (por ejemplo, uno creado después por el administrador), se crea con su precio actual.
async function configuracionBase(conn, idProducto) {
  const [filas] = await conn.query(
    `SELECT id_configuracion FROM configuracion_bebida
     WHERE id_producto = ? AND es_plantilla_global = TRUE AND id_cliente IS NULL
     ORDER BY id_configuracion LIMIT 1`,
    [idProducto]
  );
  if (filas[0]) return filas[0].id_configuracion;

  const [nueva] = await conn.query(
    `INSERT INTO configuracion_bebida (id_producto, id_cliente, nombre_display, precio_final, es_plantilla_global)
     SELECT id_producto, NULL, nombre, precio_base, TRUE FROM producto WHERE id_producto = ?`,
    [idProducto]
  );
  return nueva.insertId;
}

// Cantidades que ya tiene guardadas el carrito, como lista [{ id, qty }] (id = id del producto).
async function leerLineas(conn, idPedido) {
  const [filas] = await conn.query(
    `SELECT cb.id_producto AS id, SUM(dp.cantidad) AS qty
     FROM detalle_pedido dp
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     WHERE dp.id_pedido = ?
     GROUP BY cb.id_producto
     ORDER BY MIN(dp.id_detalle)`,
    [idPedido]
  );
  return filas.map((f) => ({ id: f.id, qty: Number(f.qty) }));
}

// Reemplaza todas las líneas del carrito por la lista recibida y recalcula el total.
// Solo se guardan productos activos, con el precio que tienen hoy en la base (no el que mande el navegador).
async function escribirLineas(conn, idPedido, items) {
  await conn.query('DELETE FROM detalle_pedido WHERE id_pedido = ?', [idPedido]);

  let total = 0;
  if (items.length > 0) {
    // "IN (?)" con una lista: mysql2 la convierte en IN (2, 5, 9).
    const [productos] = await conn.query(
      'SELECT id_producto, precio_base FROM producto WHERE activo = TRUE AND id_producto IN (?)',
      [items.map((i) => i.id)]
    );
    const precios = new Map(productos.map((p) => [p.id_producto, Number(p.precio_base)]));

    for (const item of items) {
      if (!precios.has(item.id)) continue; // producto inexistente o desactivado: no se guarda
      const precio = precios.get(item.id);
      const idConfiguracion = await configuracionBase(conn, item.id);
      // El subtotal (cantidad x precio) lo calcula MySQL solo: es una columna generada.
      await conn.query(
        'INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, idConfiguracion, item.qty, precio]
      );
      total += item.qty * precio;
    }
  }
  await conn.query('UPDATE pedido SET total = ? WHERE id_pedido = ?', [total, idPedido]);
}

// Ejecuta "trabajo" dentro de una transacción: si algo falla, no se guarda nada (rollback).
async function enTransaccion(trabajo) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await trabajo(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release(); // devuelve la conexión al pool
  }
}

// Carrito del cliente listo para mostrar: con nombre, aroma, imagen y precio ACTUALES de cada producto.
// Tiene el mismo formato que usa el navegador: [{ id, name, aroma, img, price, qty }].
exports.obtener = async (idCliente) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre AS name, c.nombre AS aroma, p.imagen,
            p.precio_base AS price, SUM(dp.cantidad) AS qty
     FROM pedido pe
     JOIN detalle_pedido dp ON dp.id_pedido = pe.id_pedido
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     JOIN producto p ON p.id_producto = cb.id_producto
     LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
     WHERE pe.id_cliente = ? AND pe.estado = 'carrito' AND p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, c.nombre, p.imagen, p.precio_base
     ORDER BY MIN(dp.id_detalle)`,
    [idCliente]
  );
  return filas.map((f) => ({
    id: f.id,
    name: f.name,
    aroma: f.aroma,
    img: '/img/productos/' + f.imagen,
    price: Number(f.price),
    qty: Math.min(Number(f.qty), MAX_CANTIDAD),
  }));
};

// Guarda el carrito completo que manda el navegador (cada vez que el cliente cambia algo).
exports.guardar = async (idCliente, items) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    await escribirLineas(conn, idPedido, items);
  });
  return exports.obtener(idCliente);
};

// HU-026, criterio 2: une el carrito armado como visitante con el que ya estaba guardado en la cuenta.
// Si un producto está en los dos, se suman las unidades (sin pasar del tope).
exports.fusionar = async (idCliente, itemsVisitante) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    const cantidades = new Map(); // id del producto -> unidades. Un Map recuerda el orden: primero lo guardado.
    for (const item of [...(await leerLineas(conn, idPedido)), ...itemsVisitante]) {
      cantidades.set(item.id, Math.min((cantidades.get(item.id) || 0) + item.qty, MAX_CANTIDAD));
    }
    await escribirLineas(conn, idPedido, [...cantidades].map(([id, qty]) => ({ id, qty })));
  });
  return exports.obtener(idCliente);
};

exports.MAX_CANTIDAD = MAX_CANTIDAD;
