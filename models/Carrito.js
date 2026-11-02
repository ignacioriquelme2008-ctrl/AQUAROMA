// Modelo del carrito guardado en la cuenta del cliente (HU-026).
//
// No se creó una tabla nueva: se usa la estructura de pedidos que ya tenía la base.
//   - El carrito activo es un "pedido" del cliente con estado = 'carrito' (uno por cliente).
//   - Cada producto del carrito es una fila de "detalle_pedido". Esa fila no apunta directo al
//     producto, sino a su "configuración base" (configuracion_bebida con es_plantilla_global = TRUE),
//     igual que los pedidos de prueba de la HU-008.
//
// La HU-028 confirma la compra cambiando el estado de ese pedido a 'confirmado' (ver confirmar()):
// el cliente queda sin pedido en estado 'carrito', es decir, con el carrito vacío (HU-026, criterio 3).
const db = require('../config/db');
const Direccion = require('./Direccion');
const MetodoPago = require('./MetodoPago');
const { MAX_CANTIDAD } = require('../utils/carrito');

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

// Recupera o crea la preparación personalizada del cliente para un aroma seleccionado.
// El recargo de precio se deja fuera de esta HU; lo resolverá HU-020.
async function configuracionPersonalizada(conn, idCliente, idProducto, idComponente, intensidad, precio, nombreProducto) {
  const [[componente]] = await conn.query(
    `SELECT c.id_componente, c.nombre
     FROM componente c JOIN producto p ON p.id_producto = ?
     WHERE c.id_componente = ? AND c.activo = TRUE AND c.tipo IN ('aroma', 'mixto')
       AND p.activo = TRUE AND p.es_personalizable = TRUE`,
    [idProducto, idComponente]
  );
  if (!componente) return null;

  const [existentes] = await conn.query(
    `SELECT cb.id_configuracion
     FROM configuracion_bebida cb
     JOIN configuracion_componente cc ON cc.id_configuracion = cb.id_configuracion
     WHERE cb.id_cliente = ? AND cb.id_producto = ? AND cc.id_componente = ? AND cc.cantidad = ?
       AND (SELECT COUNT(*) FROM configuracion_componente otra
            WHERE otra.id_configuracion = cb.id_configuracion) = 1
     ORDER BY cb.id_configuracion LIMIT 1`,
    [idCliente, idProducto, idComponente, intensidad]
  );
  if (existentes[0]) return existentes[0].id_configuracion;

  const [nueva] = await conn.query(
    `INSERT INTO configuracion_bebida
       (id_producto, id_cliente, nombre_display, precio_final, es_plantilla_global)
     VALUES (?, ?, ?, ?, FALSE)`,
    [idProducto, idCliente, `${nombreProducto} · ${componente.nombre}`, precio]
  );
  await conn.query(
    'INSERT INTO configuracion_componente (id_configuracion, id_componente, cantidad) VALUES (?, ?, ?)',
    [nueva.insertId, idComponente, intensidad]
  );
  return nueva.insertId;
}

// Líneas guardadas del carrito, incluyendo el aroma asociado a la preparación si existe.
async function leerLineas(conn, idPedido) {
  const [filas] = await conn.query(
    `SELECT cb.id_producto AS id,
            MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.id_componente END) AS idComponente,
            MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.cantidad END) AS intensidad,
            SUM(dp.cantidad) AS qty
     FROM detalle_pedido dp
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     LEFT JOIN configuracion_componente cc ON cc.id_configuracion = cb.id_configuracion
     LEFT JOIN componente c ON c.id_componente = cc.id_componente
     WHERE dp.id_pedido = ?
     GROUP BY cb.id_producto, cb.id_configuracion
     ORDER BY MIN(dp.id_detalle)`,
    [idPedido]
  );
  return filas.map((f) => ({ id: f.id, idComponente: f.idComponente || null, intensidad: f.idComponente ? Number(f.intensidad) : null, qty: Number(f.qty) }));
}

// Reemplaza todas las líneas del carrito por la lista recibida y recalcula el total.
// Solo se guardan productos activos, con el precio que tienen hoy en la base (no el que mande el navegador).
async function escribirLineas(conn, idPedido, idCliente, items) {
  await conn.query('DELETE FROM detalle_pedido WHERE id_pedido = ?', [idPedido]);

  let total = 0;
  if (items.length > 0) {
    // "IN (?)" con una lista: mysql2 la convierte en IN (2, 5, 9).
    const [productos] = await conn.query(
      'SELECT id_producto, nombre, precio_base FROM producto WHERE activo = TRUE AND id_producto IN (?)',
      [items.map((i) => i.id)]
    );
    const porId = new Map(productos.map((p) => [p.id_producto, p]));

    for (const item of items) {
      if (!porId.has(item.id)) continue; // producto inexistente o desactivado: no se guarda
      const producto = porId.get(item.id);
      const precio = Number(producto.precio_base);
      const idConfiguracion = item.idComponente
        ? await configuracionPersonalizada(conn, idCliente, item.id, item.idComponente, item.intensidad || 1, precio, producto.nombre)
        : await configuracionBase(conn, item.id);
      if (!idConfiguracion) continue;
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

// Carrito del cliente como lista de líneas [{ id, qty }]. Es el formato que usa el controlador
// para leer, modificar y volver a guardar el carrito (HU-022 a HU-027).
// Solo incluye productos activos: si el administrador desactiva uno (HU-037), deja de mostrarse.
exports.obtenerLineas = async (idCliente) => {
  const [filas] = await db.query(
    `SELECT cb.id_producto AS id,
            MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.id_componente END) AS idComponente,
            MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.cantidad END) AS intensidad,
            SUM(dp.cantidad) AS qty
     FROM pedido pe
     JOIN detalle_pedido dp ON dp.id_pedido = pe.id_pedido
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     JOIN producto p ON p.id_producto = cb.id_producto AND p.activo = TRUE
     LEFT JOIN configuracion_componente cc ON cc.id_configuracion = cb.id_configuracion
     LEFT JOIN componente c ON c.id_componente = cc.id_componente
     WHERE pe.id_cliente = ? AND pe.estado = 'carrito'
     GROUP BY cb.id_producto, cb.id_configuracion
     ORDER BY MIN(dp.id_detalle)`,
    [idCliente]
  );
  return filas.map((f) => ({ id: f.id, idComponente: f.idComponente || null, intensidad: f.idComponente ? Number(f.intensidad) : null, qty: Math.min(Number(f.qty), MAX_CANTIDAD) }));
};

// HU-022: unidades totales del carrito guardado en la cuenta. La usa el contador del menú
// (middlewares/carrito.js) para no traer la lista completa en cada página.
exports.contar = async (idCliente) => {
  const [[fila]] = await db.query(
    `SELECT COALESCE(SUM(dp.cantidad), 0) AS unidades
     FROM pedido pe
     JOIN detalle_pedido dp ON dp.id_pedido = pe.id_pedido
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     JOIN producto p ON p.id_producto = cb.id_producto AND p.activo = TRUE
     WHERE pe.id_cliente = ? AND pe.estado = 'carrito'`,
    [idCliente]
  );
  return Number(fila.unidades) || 0;
};

// HU-021: crea (o reutiliza) la preparación personalizada de una bebida fuera del carrito, para
// guardarla como favorita. Usa la misma función que el carrito, así la favorita apunta a la MISMA
// fila de "configuracion_bebida" (sin preparaciones ni precios duplicados).
// Devuelve el id de la configuración, o null si el producto o el aroma no son válidos.
exports.guardarConfiguracionPersonalizada = async (idCliente, { idProducto, idComponente, intensidad, precio, nombreProducto }) => {
  return enTransaccion((conn) =>
    configuracionPersonalizada(conn, idCliente, idProducto, idComponente, intensidad, precio, nombreProducto));
};

// Guarda el carrito completo que ya validó el controlador (cada vez que el cliente cambia algo).
exports.guardar = async (idCliente, items) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    await escribirLineas(conn, idPedido, idCliente, items);
  });
  return exports.obtenerLineas(idCliente);
};

// HU-026, criterio 2: une el carrito armado como visitante con el que ya estaba guardado en la cuenta.
// Si un producto está en los dos, se suman las unidades (sin pasar del tope).
exports.fusionar = async (idCliente, itemsVisitante) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    const cantidades = new Map(); // una línea por producto y aroma elegido; conserva primero lo guardado.
    for (const item of [...(await leerLineas(conn, idPedido)), ...itemsVisitante]) {
      const clave = `${item.id}:${item.idComponente || 0}:${item.intensidad || 0}`;
      const anterior = cantidades.get(clave);
      cantidades.set(clave, {
        id: item.id,
        qty: Math.min((anterior ? anterior.qty : 0) + item.qty, MAX_CANTIDAD),
        ...(item.idComponente ? { idComponente: item.idComponente, intensidad: item.intensidad || 1 } : {}),
      });
    }
    await escribirLineas(conn, idPedido, idCliente, [...cantidades.values()]);
  });
  return exports.obtenerLineas(idCliente);
};

// HU-028: error de confirmación con un mensaje que se le puede mostrar tal cual al cliente
// (carrito vacío, stock insuficiente). El controlador usa "status" como código HTTP.
class ConfirmacionError extends Error {
  constructor(mensaje, status = 409) {
    super(mensaje);
    this.name = 'ConfirmacionError';
    this.status = status;
  }
}

// HU-028: confirma la compra del carrito.
// Pasa el pedido de 'carrito' a 'confirmado' y, en la misma transacción:
//   - guarda las líneas que el cliente tiene en pantalla (criterio 2),
//   - descuenta el stock de la sucursal y registra el movimiento de inventario (criterio 4).
// HU-029: exige una dirección de entrega (guardada o nueva) y crea la fila de "envio".
// HU-030: exige un medio de pago activo y crea la fila de "pago" pendiente.
// Si algo falla (por ejemplo, ya no hay stock), no se guarda nada y el carrito sigue intacto.
// Devuelve { id, total, costoEnvio } para mostrar la orden; el costo de entrega queda por definir.
exports.confirmar = async (idCliente, idUsuario, items = null, entrega = {}) => {
  return enTransaccion(async (conn) => {
    // El carrito que se confirma es el que está guardado (el controlador solo manda las líneas
    // cuando ya las validó). Se guardan primero con las mismas reglas de guardar(): precios y
    // productos salen de la base.
    let idPedido;
    if (items && items.length > 0) {
      idPedido = await obtenerOCrearCarrito(conn, idCliente);
      await escribirLineas(conn, idPedido, idCliente, items);
    } else {
      const [filas] = await conn.query(
        `SELECT id_pedido FROM pedido
         WHERE id_cliente = ? AND estado = 'carrito'
         ORDER BY id_pedido DESC LIMIT 1 FOR UPDATE`,
        [idCliente]
      );
      if (!filas[0]) throw new ConfirmacionError('Tu carrito está vacío.', 400);
      idPedido = filas[0].id_pedido;
    }

    // Sucursal de despacho: la que ya tenga el pedido o, si no, la primera activa (Aquaroma Santiago).
    // El administrador puede cambiarla después; el stock se descuenta de la que atiende el pedido.
    const [[pedido]] = await conn.query('SELECT id_sucursal FROM pedido WHERE id_pedido = ?', [idPedido]);
    let idSucursal = pedido && pedido.id_sucursal;
    if (!idSucursal) {
      const [[sucursal]] = await conn.query(
        'SELECT id_sucursal FROM sucursal WHERE activo = TRUE ORDER BY id_sucursal LIMIT 1'
      );
      if (!sucursal) throw new ConfirmacionError('No hay una sucursal activa para despachar el pedido.', 409);
      idSucursal = sucursal.id_sucursal;
    }

    // HU-029: dirección de entrega. Puede ser una de las guardadas del cliente o una nueva que
    // se escribe en el carrito. La nueva se guarda en su cuenta y se usa en este mismo pedido.
    let direccion;
    if (entrega.idDireccion) {
      direccion = await Direccion.obtenerDeClienteEn(conn, idCliente, entrega.idDireccion);
      if (!direccion) throw new ConfirmacionError('La dirección elegida no está guardada en tu cuenta.', 400);
    } else if (entrega.nuevaDireccion) {
      direccion = await Direccion.crearEn(conn, idCliente, entrega.nuevaDireccion);
    } else {
      throw new ConfirmacionError('Elige una dirección de entrega para continuar.', 400);
    }

    // HU-030: el medio de pago tiene que existir y estar activo (el navegador puede mandar cualquier id).
    const metodo = await MetodoPago.obtenerActivo(entrega.idMetodoPago, conn);
    if (!metodo) throw new ConfirmacionError('Elige un medio de pago para continuar.', 400);

    // Líneas del carrito con el precio que muestra la página (producto.precio_base). Se bloquean
    // (FOR UPDATE) para que el stock no cambie entre la revisión del carrito y el descuento.
    // Si un producto fue desactivado (HU-037), no se incluye: la página del carrito tampoco lo muestra.
    const [lineas] = await conn.query(
      `SELECT dp.id_detalle, dp.precio_unitario, cb.id_producto, p.nombre, p.precio_base, dp.cantidad
       FROM detalle_pedido dp
       JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
       JOIN producto p ON p.id_producto = cb.id_producto
       WHERE dp.id_pedido = ? AND p.activo = TRUE
       ORDER BY dp.id_detalle
       FOR UPDATE`,
      [idPedido]
    );
    if (lineas.length === 0) throw new ConfirmacionError('Tu carrito está vacío.', 400);

    let total = 0;
    for (const linea of lineas) {
      const precio = Number(linea.precio_base);
      const cantidad = Number(linea.cantidad);
      total += precio * cantidad;

      // El precio del pedido queda congelado al momento de confirmar (el mismo que vio el cliente).
      if (Number(linea.precio_unitario) !== precio) {
        await conn.query('UPDATE detalle_pedido SET precio_unitario = ? WHERE id_detalle = ?', [precio, linea.id_detalle]);
      }

      // HU-027: verificación final y descuento atómico. El WHERE cantidad >= ? evita dejar stock
      // negativo aunque dos clientes confirmen a la vez; si no alcanza, la transacción completa
      // se revierte y el carrito sigue intacto.
      const [descuento] = await conn.query(
        `UPDATE inventario SET cantidad = cantidad - ?
         WHERE id_sucursal = ? AND id_producto = ? AND cantidad >= ?`,
        [cantidad, idSucursal, linea.id_producto, cantidad]
      );
      if (descuento.affectedRows === 0) {
        const [[stock]] = await conn.query(
          'SELECT cantidad FROM inventario WHERE id_sucursal = ? AND id_producto = ?',
          [idSucursal, linea.id_producto]
        );
        const disponible = stock ? Math.max(0, Math.floor(Number(stock.cantidad))) : 0;
        throw new ConfirmacionError(
          disponible === 0
            ? `"${linea.nombre}" ya no tiene stock disponible. Quítalo del carrito para continuar.`
            : `Solo quedan ${disponible} ${disponible === 1 ? 'unidad' : 'unidades'} de "${linea.nombre}". Ajusta la cantidad para continuar.`
        );
      }

      // El movimiento deja trazabilidad: quién vendió, desde qué sucursal y para qué pedido (criterio 4).
      await conn.query(
        `INSERT INTO movimiento_inventario
           (id_sucursal, id_producto, tipo, cantidad, tipo_origen, id_origen_referencia, id_usuario, observacion)
         VALUES (?, ?, 'salida_venta', ?, 'pedido', ?, ?, ?)`,
        [idSucursal, linea.id_producto, cantidad, idPedido, idUsuario, `Venta del pedido #${idPedido}`]
      );
    }

    // El costo de entrega se coordina con la tienda después de confirmar; no se suma al pago.
    const costoEnvio = 0;

    // HU-029: el despacho queda con la dirección copiada al momento de comprar. Si el cliente
    // cambia después su dirección, el pedido conserva la que se usó para la entrega.
    await conn.query(
      `INSERT INTO envio (id_pedido, calle, numero, departamento, comuna, region, codigo_postal, referencia, pais, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Chile', 'preparando')`,
      [idPedido, direccion.calle, direccion.numero, direccion.departamento, direccion.comuna,
       direccion.region, direccion.codigoPostal, direccion.referencia]
    );

    // HU-030: el pago queda pendiente por los productos; la entrega aún no tiene precio definido.
    // Se aprueba cuando el administrador confirma el pago en el panel (HU-040).
    await conn.query(
      `INSERT INTO pago (id_pedido, id_metodo, monto, estado) VALUES (?, ?, ?, 'pendiente')`,
      [idPedido, metodo.id, total]
    );

    // El pedido deja de ser carrito: el cliente queda sin carrito guardado (HU-026, criterio 3).
    // La fecha pasa a ser la de la compra, no la de la creación del carrito.
    const [cambio] = await conn.query(
      `UPDATE pedido
       SET estado = 'confirmado', id_sucursal = ?, total = ?, costo_envio = ?, fecha = NOW(),
           observacion = 'Pedido confirmado desde la web (HU-028)'
       WHERE id_pedido = ? AND estado = 'carrito'`,
      [idSucursal, total, costoEnvio, idPedido]
    );
    // Si otra petición confirmó el mismo carrito primero, esta no cambia nada.
    if (cambio.affectedRows === 0) throw new ConfirmacionError('Ese pedido ya fue confirmado.', 409);

    return { id: idPedido, total, costoEnvio, metodo: metodo.nombre, direccion };
  });
};

exports.MAX_CANTIDAD = MAX_CANTIDAD;
