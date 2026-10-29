// Modelo: pedidos de los clientes.
//   HU-040: el administrador los lista, filtra por estado y los hace avanzar en la secuencia logística.
//   HU-032: el cliente ve el estado y el seguimiento de cada uno de sus pedidos.
//   HU-035: el panel de administración resume las ventas y muestra los últimos pedidos.
//
// Un pedido en estado 'carrito' es el carrito guardado del cliente (HU-026), no una compra:
// por eso nunca aparece en estas listas.
const db = require('../config/db');

// Secuencia logística, en orden. Es la barra de progreso del seguimiento (HU-032).
const ESTADOS = ['confirmado', 'pagado', 'preparando', 'enviado', 'entregado'];

// Nombre de cada estado para mostrarlo en pantalla.
const NOMBRES = {
  confirmado: 'Confirmado',
  pagado: 'Pagado',
  preparando: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// A qué estados puede pasar un pedido desde cada estado (criterio 2 de HU-040).
// Se avanza de a un paso; se puede cancelar mientras no haya salido a despacho.
const SIGUIENTES = {
  confirmado: ['pagado', 'cancelado'],
  pagado: ['preparando', 'cancelado'],
  preparando: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};

// Estados que cuentan como venta (los mismos de "Más vendido" y de vw_ventas_consolidadas).
const ESTADOS_VENTA = ['pagado', 'preparando', 'enviado', 'entregado'];

exports.ESTADOS = ESTADOS;
exports.NOMBRES = NOMBRES;
exports.SIGUIENTES = SIGUIENTES;

const aNumero = (f) => ({ ...f, total: Number(f.total), costo_envio: Number(f.costo_envio) });

// Lista de pedidos para el administrador, del más nuevo al más antiguo. estado = null trae todos.
exports.listarAdmin = async (estado = null, limite = 200) => {
  const [filas] = await db.query(
    `SELECT pe.id_pedido AS id, pe.fecha, pe.estado, pe.total, pe.costo_envio,
            CONCAT(c.nombre, ' ', COALESCE(c.apellido, '')) AS cliente, c.correo,
            (SELECT COALESCE(SUM(dp.cantidad), 0) FROM detalle_pedido dp WHERE dp.id_pedido = pe.id_pedido) AS unidades
     FROM pedido pe
     JOIN cliente c ON c.id_cliente = pe.id_cliente
     WHERE pe.estado <> 'carrito' AND (? IS NULL OR pe.estado = ?)
     ORDER BY pe.fecha DESC, pe.id_pedido DESC
     LIMIT ?`,
    [estado, estado, limite]
  );
  return filas.map((f) => ({ ...aNumero(f), unidades: Number(f.unidades) }));
};

// Cantidad de pedidos en cada estado: { confirmado: 1, pagado: 2, ... } (filtros de HU-040 y gráfico de HU-035).
exports.contarPorEstado = async () => {
  const [filas] = await db.query(
    "SELECT estado, COUNT(*) AS n FROM pedido WHERE estado <> 'carrito' GROUP BY estado"
  );
  const conteo = Object.fromEntries([...ESTADOS, 'cancelado'].map((e) => [e, 0]));
  filas.forEach((f) => { conteo[f.estado] = Number(f.n); });
  return conteo;
};

// Ventas acumuladas (HU-035): suma de los pedidos que cuentan como venta, con su envío.
exports.resumenVentas = async () => {
  const [filas] = await db.query(
    `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total + costo_envio), 0) AS monto
     FROM pedido WHERE estado IN (?)`,
    [ESTADOS_VENTA]
  );
  return { pedidos: Number(filas[0].pedidos), monto: Number(filas[0].monto) };
};

// Un pedido con su cliente, sus productos y su despacho.
// idCliente: si se indica, solo devuelve el pedido si es de ese cliente (HU-032: cada uno ve solo los suyos).
exports.obtener = async (id, { idCliente = null } = {}) => {
  const [filas] = await db.query(
    `SELECT pe.id_pedido AS id, pe.id_cliente, pe.fecha, pe.estado, pe.total, pe.costo_envio, pe.observacion,
            c.nombre, c.apellido, c.correo, c.telefono, s.nombre AS sucursal
     FROM pedido pe
     JOIN cliente c ON c.id_cliente = pe.id_cliente
     LEFT JOIN sucursal s ON s.id_sucursal = pe.id_sucursal
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

  // HU-030: medio de pago con que se compró (el último registrado para el pedido).
  const [pagos] = await db.query(
    `SELECT mp.nombre AS metodo, pa.monto, pa.estado
     FROM pago pa
     JOIN metodo_pago mp ON mp.id_metodo = pa.id_metodo
     WHERE pa.id_pedido = ?
     ORDER BY pa.id_pago DESC LIMIT 1`,
    [id]
  );
  pedido.pago = pagos[0] ? { ...pagos[0], monto: Number(pagos[0].monto) } : null;

  return pedido;
};

// Pedidos de un cliente (para su página "Mis pedidos"), del más nuevo al más antiguo.
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

// Error para un cambio de estado que no corresponde (el controlador lo muestra como aviso).
class CambioInvalidoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.code = 'CAMBIO_INVALIDO';
  }
}
exports.CambioInvalidoError = CambioInvalidoError;

// Cambia el estado de un pedido (HU-040). Todo en una transacción, con el pedido bloqueado
// (FOR UPDATE) para que dos administradores no lo cambien a la vez.
//   - Solo se permite pasar a un estado de SIGUIENTES[estado actual] (criterio 2).
//   - Al pasar a 'enviado' se guardan la empresa de transporte y el código de seguimiento (criterio 3)
//     en la tabla envio. Si el pedido aún no tiene envío (lo crea la HU-029 al comprar), se arma con
//     la dirección principal del cliente.
//   - El envío sigue al pedido: en preparación, en camino, entregado o cancelado.
exports.cambiarEstado = async (id, nuevo, { transportista = null, tracking = null } = {}) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [filas] = await conn.query('SELECT id_cliente, estado FROM pedido WHERE id_pedido = ? FOR UPDATE', [id]);
    const pedido = filas[0];
    if (!pedido || pedido.estado === 'carrito') throw new CambioInvalidoError('Ese pedido no existe.');
    if (!(SIGUIENTES[pedido.estado] || []).includes(nuevo)) {
      throw new CambioInvalidoError(`Un pedido "${NOMBRES[pedido.estado]}" no puede pasar a "${NOMBRES[nuevo] || nuevo}".`);
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
