






const db = require('../config/db');


const ESTADOS = ['confirmado', 'pagado', 'preparando', 'enviado', 'entregado'];


const NOMBRES = {
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  preparando: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};



const SIGUIENTES = {
  confirmado: ['pagado', 'cancelado'],
  pagado: ['preparando', 'cancelado'],
  preparando: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};


const ESTADOS_VENTA = ['pagado', 'preparando', 'enviado', 'entregado'];
const ESTADOS_CANCELABLES = ['confirmado', 'pagado', 'preparando'];

exports.ESTADOS = ESTADOS;
exports.NOMBRES = NOMBRES;
exports.SIGUIENTES = SIGUIENTES;
exports.ESTADOS_CANCELABLES = ESTADOS_CANCELABLES;

const aNumero = (f) => ({ ...f, total: Number(f.total), costo_envio: Number(f.costo_envio) });


exports.listarAdmin = async (estado = null, limite = 200) => {
  const [filas] = await db.query(
    `SELECT pe.id_pedido AS id, pe.fecha, pe.estado, pe.total, pe.costo_envio,
            CONCAT(c.nombre, ' ', COALESCE(c.apellido, '')) AS cliente, c.correo, s.nombre AS sucursal,
            (SELECT COALESCE(SUM(dp.cantidad), 0) FROM detalle_pedido dp WHERE dp.id_pedido = pe.id_pedido) AS unidades
     FROM pedido pe
     JOIN cliente c ON c.id_cliente = pe.id_cliente
     LEFT JOIN sucursal s ON s.id_sucursal = pe.id_sucursal
     WHERE pe.estado <> 'carrito' AND (? IS NULL OR pe.estado = ?)
     ORDER BY pe.fecha DESC, pe.id_pedido DESC
     LIMIT ?`,
    [estado, estado, limite]
  );
  return filas.map((f) => ({ ...aNumero(f), unidades: Number(f.unidades) }));
};


exports.contarPorEstado = async () => {
  const [filas] = await db.query(
    "SELECT estado, COUNT(*) AS n FROM pedido WHERE estado <> 'carrito' GROUP BY estado"
  );
  const conteo = Object.fromEntries([...ESTADOS, 'cancelado'].map((e) => [e, 0]));
  filas.forEach((f) => { conteo[f.estado] = Number(f.n); });
  return conteo;
};


exports.resumenVentas = async () => {
  const [filas] = await db.query(
    `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total + costo_envio), 0) AS monto
     FROM pedido WHERE estado IN (?)`,
    [ESTADOS_VENTA]
  );
  return { pedidos: Number(filas[0].pedidos), monto: Number(filas[0].monto) };
};



exports.obtener = async (id, { idCliente = null } = {}) => {
  const [filas] = await db.query(
    `SELECT pe.id_pedido AS id, pe.id_cliente, pe.fecha, pe.estado, pe.total, pe.costo_envio, pe.observacion,
            c.nombre, c.apellido, c.correo, c.telefono, s.nombre AS sucursal,
            COALESCE(u.correo, c.correo) AS correo_cuenta
     FROM pedido pe
     JOIN cliente c ON c.id_cliente = pe.id_cliente
     LEFT JOIN sucursal s ON s.id_sucursal = pe.id_sucursal
     LEFT JOIN usuario u ON u.id_cliente = c.id_cliente
     WHERE pe.id_pedido = ? AND pe.estado <> 'carrito' AND (? IS NULL OR pe.id_cliente = ?)`,
    [id, idCliente, idCliente]
  );
  if (!filas[0]) return null;
  const pedido = aNumero(filas[0]);

  const [items] = await db.query(
    `SELECT COALESCE(p.nombre, cb.nombre_display) AS nombre, p.imagen, dp.cantidad, dp.precio_unitario, dp.subtotal
     FROM detalle_pedido dp
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     LEFT JOIN producto p ON p.id_producto = cb.id_producto
     WHERE dp.id_pedido = ?
     ORDER BY dp.id_detalle`,
    [id]
  );
  pedido.items = items.map((i) => ({ ...i, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal) }));

  const [envios] = await db.query(
    `SELECT calle, numero, departamento, comuna, region, codigo_postal, referencia,
            transportista, tracking, fecha_envio, fecha_entrega, estado
     FROM envio WHERE id_pedido = ?`,
    [id]
  );
  pedido.envio = envios[0] || null;


  const [pagos] = await db.query(
    `SELECT mp.nombre AS metodo, pa.monto, pa.estado,
            EXISTS (SELECT 1 FROM paypal_checkout pc WHERE pc.id_pago = pa.id_pago) AS verificado_por_paypal
     FROM pago pa
     JOIN metodo_pago mp ON mp.id_metodo = pa.id_metodo
     WHERE pa.id_pedido = ?
     ORDER BY pa.id_pago DESC LIMIT 1`,
    [id]
  );
  pedido.pago = pagos[0] ? { ...pagos[0], monto: Number(pagos[0].monto) } : null;

  return pedido;
};


exports.listarDeCliente = async (idCliente) => {
  const [filas] = await db.query(
    `SELECT pe.id_pedido AS id, pe.fecha, pe.estado, pe.total, pe.costo_envio,
            (SELECT COALESCE(SUM(dp.cantidad), 0) FROM detalle_pedido dp WHERE dp.id_pedido = pe.id_pedido) AS unidades
     FROM pedido pe
     WHERE pe.id_cliente = ? AND pe.estado <> 'carrito'
     ORDER BY pe.fecha DESC, pe.id_pedido DESC`,
    [idCliente]
  );
  return filas.map((f) => ({ ...aNumero(f), unidades: Number(f.unidades) }));
};


class CambioInvalidoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.code = 'CAMBIO_INVALIDO';
  }
}
exports.CambioInvalidoError = CambioInvalidoError;



async function cancelarEnTransaccion(conn, id, idUsuario, idClienteEsperado = null) {
  const [pedidos] = await conn.query(
    `SELECT id_pedido, id_cliente, id_sucursal, estado
     FROM pedido WHERE id_pedido = ? AND (? IS NULL OR id_cliente = ?) FOR UPDATE`,
    [id, idClienteEsperado, idClienteEsperado]
  );
  const pedido = pedidos[0];
  if (!pedido || pedido.estado === 'carrito') throw new CambioInvalidoError('Ese pedido no existe en tu cuenta.');
  if (!ESTADOS_CANCELABLES.includes(pedido.estado)) {
    throw new CambioInvalidoError('Este pedido ya no se puede cancelar directamente porque salió a despacho o fue entregado.');
  }

  const [pagos] = await conn.query(
    `SELECT id_pago, monto, estado FROM pago
     WHERE id_pedido = ? ORDER BY id_pago DESC LIMIT 1 FOR UPDATE`,
    [id]
  );
  const pago = pagos[0] || null;
  const pagado = pedido.estado === 'pagado' || Boolean(pago && ['aprobado', 'reembolsado_parcial'].includes(pago.estado));
  let solicitudReembolso = false;
  let montoReembolso = 0;
  if (pagado) {
    if (!pago) throw new Error(`El pedido pagado #${id} no tiene un pago asociado.`);
    const [[devoluciones]] = await conn.query(
      'SELECT COALESCE(SUM(monto), 0) AS monto FROM reembolso WHERE id_pago = ?',
      [pago.id_pago]
    );
    montoReembolso = Math.max(0, Number(pago.monto) - Number(devoluciones.monto));
    if (montoReembolso > 0) {
      const [existente] = await conn.query('SELECT id_solicitud FROM solicitud_reembolso WHERE id_pago = ? FOR UPDATE', [pago.id_pago]);
      if (!existente[0]) {
        await conn.query(
          `INSERT INTO solicitud_reembolso (id_pago, id_usuario_solicita, monto, motivo)
           VALUES (?, ?, ?, ?)`,
          [pago.id_pago, idUsuario, montoReembolso, `Cancelación del pedido #${id}`]
        );
        solicitudReembolso = true;
      }
    }
  }

  const [lineas] = await conn.query(
    `SELECT cb.id_producto, SUM(dp.cantidad) AS cantidad
     FROM detalle_pedido dp
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     WHERE dp.id_pedido = ?
     GROUP BY cb.id_producto`,
    [id]
  );
  for (const linea of lineas) {
    const cantidad = Number(linea.cantidad);
    await conn.query(
      `INSERT INTO inventario (id_sucursal, id_producto, cantidad)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
      [pedido.id_sucursal, linea.id_producto, cantidad]
    );
    await conn.query(
      `INSERT INTO movimiento_inventario
         (id_sucursal, id_producto, tipo, cantidad, tipo_origen, id_origen_referencia, id_usuario, observacion)
       VALUES (?, ?, 'entrada_devolucion', ?, 'pedido', ?, ?, ?)`,
      [pedido.id_sucursal, linea.id_producto, cantidad, id, idUsuario, `Reingreso por cancelación del pedido #${id}`]
    );
  }

  await conn.query("UPDATE pedido SET estado = 'cancelado' WHERE id_pedido = ?", [id]);
  await conn.query("UPDATE envio SET estado = 'cancelado' WHERE id_pedido = ?", [id]);
  return { id, solicitudReembolso, montoReembolso };
}

exports.cancelarDeCliente = async (id, idCliente, idUsuario) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await cancelarEnTransaccion(conn, id, idUsuario, idCliente);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};








exports.historialAdmin = async (id) => {
  const [filas] = await db.query(
    `SELECT estado, nombre_admin AS nombre, fecha FROM pedido_historial_admin
     WHERE id_pedido = ? ORDER BY id_historial DESC`,
    [id]
  );
  return filas;
};

exports.cambiarEstado = async (id, nuevo, { transportista = null, tracking = null, idUsuario = null, nombreAdmin = 'Administrador' } = {}) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [filas] = await conn.query('SELECT id_cliente, estado FROM pedido WHERE id_pedido = ? FOR UPDATE', [id]);
    const pedido = filas[0];
    if (!pedido || pedido.estado === 'carrito') throw new CambioInvalidoError('Ese pedido no existe.');
    if (!(SIGUIENTES[pedido.estado] || []).includes(nuevo)) {
      throw new CambioInvalidoError(`Un pedido "${NOMBRES[pedido.estado]}" no puede pasar a "${NOMBRES[nuevo] || nuevo}".`);
    }

    if (nuevo === 'pagado') {
      const [pagos] = await conn.query(
        'SELECT 1 FROM paypal_checkout pc JOIN pago p ON p.id_pago = pc.id_pago WHERE p.id_pedido = ? LIMIT 1',
        [id]
      );
      if (pagos.length) throw new CambioInvalidoError('PayPal confirma el pago automáticamente.');
    }

    if (idUsuario) {
      await conn.query(
        'INSERT INTO pedido_historial_admin (id_pedido, id_usuario, nombre_admin, estado) VALUES (?, ?, ?, ?)',
        [id, idUsuario, nombreAdmin, nuevo]
      );
    }

    if (nuevo === 'cancelado') {
      if (!idUsuario) throw new Error('Se requiere el usuario que autoriza la cancelación.');
      const resultado = await cancelarEnTransaccion(conn, id, idUsuario);
      await conn.commit();
      return resultado;
    }

    await conn.query('UPDATE pedido SET estado = ? WHERE id_pedido = ?', [nuevo, id]);

    const [envios] = await conn.query('SELECT id_envio FROM envio WHERE id_pedido = ?', [id]);
    if (nuevo === 'enviado') {
      if (envios[0]) {
        await conn.query(
          "UPDATE envio SET transportista = ?, tracking = ?, fecha_envio = NOW(), estado = 'en_camino' WHERE id_pedido = ?",
          [transportista, tracking, id]
        );
      } else {
        const [dir] = await conn.query(
          `SELECT d.calle, d.numero, d.departamento, d.codigo_postal, d.referencia, u.comuna, u.region, u.pais
           FROM cliente_direccion cd
           JOIN direccion d ON d.id_direccion = cd.id_direccion
           JOIN ubicacion u ON u.id_ubicacion = d.id_ubicacion
           WHERE cd.id_cliente = ?
           ORDER BY cd.es_principal DESC LIMIT 1`,
          [pedido.id_cliente]
        );
        if (!dir[0]) throw new CambioInvalidoError('El cliente no tiene una dirección registrada para el despacho.');
        const d = dir[0];
        await conn.query(
          `INSERT INTO envio (id_pedido, calle, numero, departamento, comuna, region, codigo_postal, referencia, pais,
                              transportista, tracking, fecha_envio, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'en_camino')`,
          [id, d.calle, d.numero, d.departamento, d.comuna, d.region, d.codigo_postal, d.referencia, d.pais, transportista, tracking]
        );
      }
    } else if (envios[0]) {
      const estadoEnvio = { preparando: 'preparando', entregado: 'entregado', cancelado: 'cancelado' }[nuevo];
      if (estadoEnvio === 'entregado') {
        await conn.query("UPDATE envio SET estado = 'entregado', fecha_entrega = NOW() WHERE id_pedido = ?", [id]);
      } else if (estadoEnvio) {
        await conn.query('UPDATE envio SET estado = ? WHERE id_pedido = ?', [estadoEnvio, id]);
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
