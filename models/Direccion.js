// Modelo de direcciones de entrega del cliente (HU-029).
// Una dirección vive en dos tablas: "direccion" (calle, número, referencias) y "ubicacion"
// (región, comuna, país). "cliente_direccion" une la dirección con el cliente e indica cuál es la principal.
const db = require('../config/db');

// Filas de la base con los nombres que usan las vistas y el navegador.
const aDireccion = (f) => ({
  id: f.id,
  alias: f.alias,
  calle: f.calle,
  numero: f.numero,
  departamento: f.departamento,
  comuna: f.comuna,
  region: f.region,
  codigoPostal: f.codigo_postal,
  referencia: f.referencia,
  principal: Boolean(f.es_principal),
});

// Todas las direcciones del cliente, con la principal primero (es la que viene marcada).
exports.listarDeCliente = async (idCliente) => {
  const [filas] = await db.query(
    `SELECT d.id_direccion AS id, cd.alias, cd.es_principal, d.calle, d.numero, d.departamento,
            d.codigo_postal, d.referencia, u.comuna, u.region
     FROM cliente_direccion cd
     JOIN direccion d ON d.id_direccion = cd.id_direccion
     JOIN ubicacion u ON u.id_ubicacion = d.id_ubicacion
     WHERE cd.id_cliente = ?
     ORDER BY cd.es_principal DESC, d.id_direccion`,
    [idCliente]
  );
  return filas.map(aDireccion);
};

// Una dirección del cliente. Devuelve null si no existe o es de otro cliente: así nadie puede
// confirmar un pedido con la dirección de otra persona cambiando el id en la petición.
exports.obtenerDeCliente = async (idCliente, idDireccion) => {
  const [filas] = await db.query(
    `SELECT d.id_direccion AS id, cd.alias, cd.es_principal, d.calle, d.numero, d.departamento,
            d.codigo_postal, d.referencia, u.comuna, u.region, u.pais
     FROM cliente_direccion cd
     JOIN direccion d ON d.id_direccion = cd.id_direccion
     JOIN ubicacion u ON u.id_ubicacion = d.id_ubicacion
     WHERE cd.id_cliente = ? AND d.id_direccion = ?`,
    [idCliente, idDireccion]
  );
  return filas[0] ? aDireccion(filas[0]) : null;
};

// Igual que obtenerDeCliente() pero dentro de una transacción, para usarla al confirmar el pedido.
exports.obtenerDeClienteEn = async (conn, idCliente, idDireccion) => {
  const [filas] = await conn.query(
    `SELECT d.id_direccion AS id, cd.alias, cd.es_principal, d.calle, d.numero, d.departamento,
            d.codigo_postal, d.referencia, u.comuna, u.region, u.pais
     FROM cliente_direccion cd
     JOIN direccion d ON d.id_direccion = cd.id_direccion
     JOIN ubicacion u ON u.id_ubicacion = d.id_ubicacion
     WHERE cd.id_cliente = ? AND d.id_direccion = ?`,
    [idCliente, idDireccion]
  );
  return filas[0] ? aDireccion(filas[0]) : null;
};

// Guarda una dirección nueva usando una conexión que ya tiene una transacción abierta.
// La comuna y la región se guardan en "ubicacion": si ya existe esa comuna, se reutiliza.
// Se exporta porque el carrito la usa al confirmar (HU-029): la dirección y el pedido se
// guardan en la MISMA transacción.
async function crearEn(conn, idCliente, d) {
  const [ubicaciones] = await conn.query(
    `SELECT id_ubicacion FROM ubicacion
     WHERE region = ? AND comuna = ? AND pais = 'Chile'
     ORDER BY id_ubicacion LIMIT 1`,
    [d.region, d.comuna]
  );
  let idUbicacion;
  if (ubicaciones[0]) {
    idUbicacion = ubicaciones[0].id_ubicacion;
  } else {
    const [nuevaUbicacion] = await conn.query(
      `INSERT INTO ubicacion (region, comuna, pais) VALUES (?, ?, 'Chile')`,
      [d.region, d.comuna]
    );
    idUbicacion = nuevaUbicacion.insertId;
  }

  const [nueva] = await conn.query(
    `INSERT INTO direccion (id_ubicacion, calle, numero, departamento, codigo_postal, referencia)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [idUbicacion, d.calle, d.numero || null, d.departamento || null, d.codigoPostal || null, d.referencia || null]
  );

  const [[cuenta]] = await conn.query(
    'SELECT COUNT(*) AS n FROM cliente_direccion WHERE id_cliente = ?',
    [idCliente]
  );
  await conn.query(
    `INSERT INTO cliente_direccion (id_cliente, id_direccion, es_principal, alias)
     VALUES (?, ?, ?, ?)`,
    [idCliente, nueva.insertId, cuenta.n === 0 ? 1 : 0, d.alias || null]
  );

  return {
    id: nueva.insertId,
    alias: d.alias || null,
    calle: d.calle,
    numero: d.numero || null,
    departamento: d.departamento || null,
    comuna: d.comuna,
    region: d.region,
    codigoPostal: d.codigoPostal || null,
    referencia: d.referencia || null,
    principal: cuenta.n === 0,
  };
}
exports.crearEn = crearEn;

// Guarda una dirección nueva del cliente en su propia transacción (por ejemplo, desde su perfil).
// Si es la primera, queda como principal.
exports.crear = async (idCliente, d) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const creada = await crearEn(conn, idCliente, d);
    await conn.commit();
    return creada;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
