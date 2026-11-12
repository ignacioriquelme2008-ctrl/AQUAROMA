









const db = require('../config/db');
const { buscarSucursalConStock } = require('../utils/stockVenta');
const Direccion = require('./Direccion');
const MetodoPago = require('./MetodoPago');
const ventas = require('../config/ventas');
const { MAX_CANTIDAD } = require('../utils/carrito');


async function obtenerOCrearCarrito(conn, idCliente) {


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



async function configuracionPersonalizada(conn, idCliente, idProducto, idComponente, intensidad, precioBase, nombreProducto) {
  const [[componente]] = await conn.query(
    `SELECT c.id_componente, c.nombre, c.recargo_precio
     FROM componente c JOIN producto p ON p.id_producto = ?
     WHERE c.id_componente = ? AND c.activo = TRUE AND c.tipo IN ('aroma', 'mixto')
       AND p.activo = TRUE AND p.es_personalizable = TRUE`,
    [idProducto, idComponente]
  );
  if (!componente) return null;
  const recargoPorDosis = Number(componente.recargo_precio);
  const precio = ventas.precioPersonalizado(precioBase, intensidad, recargoPorDosis);
  const nombreDisplay = `${nombreProducto} · ${componente.nombre}`;

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
  if (existentes[0]) {
    await conn.query(
      'UPDATE configuracion_bebida SET nombre_display = ?, precio_final = ? WHERE id_configuracion = ?',
      [nombreDisplay, precio, existentes[0].id_configuracion]
    );
    return { id: existentes[0].id_configuracion, precio };
  }

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
  return { id: nueva.insertId, precio };
}


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



async function escribirLineas(conn, idPedido, idCliente, items) {
  await conn.query('DELETE FROM detalle_pedido WHERE id_pedido = ?', [idPedido]);

  let total = 0;
  if (items.length > 0) {

    const [productos] = await conn.query(
      'SELECT id_producto, nombre, precio_base FROM producto WHERE activo = TRUE AND id_producto IN (?)',
      [items.map((i) => i.id)]
    );
    const porId = new Map(productos.map((p) => [p.id_producto, p]));

    for (const item of items) {
      if (!porId.has(item.id)) continue;
      const producto = porId.get(item.id);
      const precioBase = Number(producto.precio_base);
      const intensidad = item.intensidad || 1;
      let precio = precioBase;
      let idConfiguracion;
      if (item.idComponente) {
        const personalizada = await configuracionPersonalizada(
          conn, idCliente, item.id, item.idComponente, intensidad, precioBase, producto.nombre
        );
        if (!personalizada) continue;
        ({ id: idConfiguracion, precio } = personalizada);
      } else {
        idConfiguracion = await configuracionBase(conn, item.id);
      }
      if (!idConfiguracion) continue;

      await conn.query(
        'INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, idConfiguracion, item.qty, precio]
      );
      total += item.qty * precio;
    }
  }
  await conn.query('UPDATE pedido SET total = ? WHERE id_pedido = ?', [total, idPedido]);
}


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
    conn.release();
  }
}




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





exports.guardarConfiguracionPersonalizada = async (idCliente, { idProducto, idComponente, intensidad, precioBase, nombreProducto }) => {
  return enTransaccion((conn) =>
    configuracionPersonalizada(conn, idCliente, idProducto, idComponente, intensidad, precioBase, nombreProducto));
};


exports.guardar = async (idCliente, items) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    await escribirLineas(conn, idPedido, idCliente, items);
  });
  return exports.obtenerLineas(idCliente);
};



exports.fusionar = async (idCliente, itemsVisitante) => {
  await enTransaccion(async (conn) => {
    const idPedido = await obtenerOCrearCarrito(conn, idCliente);
    const cantidades = new Map();
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



class ConfirmacionError extends Error {
  constructor(mensaje, status = 409) {
    super(mensaje);
    this.name = 'ConfirmacionError';
    this.status = status;
  }
}









exports.confirmar = async (idCliente, idUsuario, items = null, entrega = {}) => {
  return enTransaccion(async (conn) => {



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


    const [[pedido]] = await conn.query('SELECT id_sucursal FROM pedido WHERE id_pedido = ?', [idPedido]);
    let idSucursal = pedido && pedido.id_sucursal;



    let direccion;
    if (entrega.idDireccion) {
      direccion = await Direccion.obtenerDeClienteEn(conn, idCliente, entrega.idDireccion);
      if (!direccion) throw new ConfirmacionError('La dirección elegida no está guardada en tu cuenta.', 400);
    } else if (entrega.nuevaDireccion) {
      direccion = await Direccion.crearEn(conn, idCliente, entrega.nuevaDireccion);
    } else {
      throw new ConfirmacionError('Elige una dirección de entrega para continuar.', 400);
    }


    const metodo = await MetodoPago.obtenerActivo(entrega.idMetodoPago, conn);
    if (!metodo) throw new ConfirmacionError('Elige un medio de pago para continuar.', 400);




    const [lineas] = await conn.query(
      `SELECT dp.id_detalle, dp.precio_unitario, cb.id_producto, p.nombre, p.precio_base, dp.cantidad,
             (SELECT MAX(cc.cantidad)
               FROM configuracion_componente cc
               JOIN componente co ON co.id_componente = cc.id_componente
               WHERE cc.id_configuracion = cb.id_configuracion
                  AND co.tipo IN ('aroma', 'mixto')) AS intensidad,
              (SELECT MAX(cc.id_componente)
               FROM configuracion_componente cc
               JOIN componente co ON co.id_componente = cc.id_componente
               WHERE cc.id_configuracion = cb.id_configuracion
                 AND co.tipo IN ('aroma', 'mixto')) AS idComponente,
              (SELECT MAX(co.recargo_precio)
               FROM configuracion_componente cc
               JOIN componente co ON co.id_componente = cc.id_componente
               WHERE cc.id_configuracion = cb.id_configuracion
                 AND co.tipo IN ('aroma', 'mixto')) AS recargoPorDosis
       FROM detalle_pedido dp
       JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
       JOIN producto p ON p.id_producto = cb.id_producto
       WHERE dp.id_pedido = ? AND p.activo = TRUE
       ORDER BY dp.id_detalle
       FOR UPDATE`,
      [idPedido]
    );
    if (lineas.length === 0) throw new ConfirmacionError('Tu carrito está vacío.', 400);
    idSucursal = await buscarSucursalConStock(conn, lineas, idSucursal);
    if (!idSucursal) {
      throw new ConfirmacionError('No hay una sucursal con stock suficiente para todos los productos de tu pedido. Ajusta las cantidades o los productos para continuar.', 409);
    }


    let total = 0;
    for (const linea of lineas) {
      const precioBase = Number(linea.precio_base);
      const precio = linea.intensidad
        ? ventas.precioPersonalizado(precioBase, Number(linea.intensidad), Number(linea.recargoPorDosis))
        : precioBase;
      const cantidad = Number(linea.cantidad);
      total += precio * cantidad;


      if (Number(linea.precio_unitario) !== precio) {
        await conn.query('UPDATE detalle_pedido SET precio_unitario = ? WHERE id_detalle = ?', [precio, linea.id_detalle]);
      }




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


      await conn.query(
        `INSERT INTO movimiento_inventario
           (id_sucursal, id_producto, tipo, cantidad, tipo_origen, id_origen_referencia, id_usuario, observacion)
         VALUES (?, ?, 'salida_venta', ?, 'pedido', ?, ?, ?)`,
        [idSucursal, linea.id_producto, cantidad, idPedido, idUsuario, `Venta del pedido #${idPedido}`]
      );
    }


    const costoEnvio = 0;



    await conn.query(
      `INSERT INTO envio (id_pedido, calle, numero, departamento, comuna, region, codigo_postal, referencia, pais, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Chile', 'preparando')`,
      [idPedido, direccion.calle, direccion.numero, direccion.departamento, direccion.comuna,
       direccion.region, direccion.codigoPostal, direccion.referencia]
    );



    const [pagoCreado] = await conn.query(
      `INSERT INTO pago (id_pedido, id_metodo, monto, estado) VALUES (?, ?, ?, 'pendiente')`,
      [idPedido, metodo.id, total]
    );
    if (entrega.paypalCotizacion) {
      const cambio = entrega.paypalCotizacion;
      const montoUsd = require('../config/tipoCambio').convertir(total, cambio.tasa);
      await conn.query(
        `INSERT INTO paypal_checkout (id_pago, monto_usd, tasa_clp, fecha_tasa) VALUES (?, ?, ?, ?)`,
        [pagoCreado.insertId, montoUsd, cambio.tasa, new Date(cambio.actualizadoEn)]
      );
    }



    const [cambio] = await conn.query(
      `UPDATE pedido
       SET estado = 'confirmado', id_sucursal = ?, total = ?, costo_envio = ?, fecha = NOW(),
           observacion = 'Pedido confirmado desde la web (HU-028)'
       WHERE id_pedido = ? AND estado = 'carrito'`,
      [idSucursal, total, costoEnvio, idPedido]
    );

    if (cambio.affectedRows === 0) throw new ConfirmacionError('Ese pedido ya fue confirmado.', 409);

    return { id: idPedido, total, costoEnvio, metodo: metodo.nombre, direccion };
  });
};

exports.MAX_CANTIDAD = MAX_CANTIDAD;
