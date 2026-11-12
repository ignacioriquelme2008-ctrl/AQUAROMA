


const db = require('../config/db');


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





async function crearEn(conn, idCliente, d) {
  const idUbicacion = await ubicacionEn(conn, d.region, d.comuna);

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



async function ubicacionEn(conn, region, comuna) {
  const [filas] = await conn.query(
    `SELECT id_ubicacion FROM ubicacion
     WHERE region = ? AND comuna = ? AND pais = 'Chile'
     ORDER BY id_ubicacion LIMIT 1`,
    [region, comuna]
  );
  if (filas[0]) return filas[0].id_ubicacion;

  const [nueva] = await conn.query(
    `INSERT INTO ubicacion (region, comuna, pais) VALUES (?, ?, 'Chile')`,
    [region, comuna]
  );
  return nueva.insertId;
}



exports.actualizar = async (idCliente, idDireccion, d) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [filas] = await conn.query(
      `SELECT d.id_direccion
       FROM cliente_direccion cd
       JOIN direccion d ON d.id_direccion = cd.id_direccion
       WHERE cd.id_cliente = ? AND d.id_direccion = ?
       FOR UPDATE`,
      [idCliente, idDireccion]
    );
    if (!filas[0]) {
      await conn.rollback();
      return null;
    }

    const idUbicacion = await ubicacionEn(conn, d.region, d.comuna);
    await conn.query(
      `UPDATE direccion
       SET id_ubicacion = ?, calle = ?, numero = ?, departamento = ?, codigo_postal = ?, referencia = ?
       WHERE id_direccion = ?`,
      [idUbicacion, d.calle, d.numero || null, d.departamento || null, d.codigoPostal || null, d.referencia || null, idDireccion]
    );
    await conn.query(
      'UPDATE cliente_direccion SET alias = ? WHERE id_cliente = ? AND id_direccion = ?',
      [d.alias || null, idCliente, idDireccion]
    );

    await conn.commit();
    return { ...d, id: Number(idDireccion) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};



exports.eliminar = async (idCliente, idDireccion) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [filas] = await conn.query(
      `SELECT es_principal FROM cliente_direccion
       WHERE id_cliente = ? AND id_direccion = ?
       FOR UPDATE`,
      [idCliente, idDireccion]
    );
    if (!filas[0]) {
      await conn.rollback();
      return null;
    }
    const eraPrincipal = Boolean(filas[0].es_principal);



    await conn.query('DELETE FROM cliente_direccion WHERE id_cliente = ? AND id_direccion = ?', [idCliente, idDireccion]);
    await conn.query('DELETE FROM direccion WHERE id_direccion = ?', [idDireccion]);

    if (eraPrincipal) {
      const [restantes] = await conn.query(
        'SELECT id_direccion FROM cliente_direccion WHERE id_cliente = ? ORDER BY id_direccion LIMIT 1',
        [idCliente]
      );
      if (restantes[0]) {
        await conn.query(
          'UPDATE cliente_direccion SET es_principal = TRUE WHERE id_cliente = ? AND id_direccion = ?',
          [idCliente, restantes[0].id_direccion]
        );
      }
    }

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};



exports.marcarPrincipal = async (idCliente, idDireccion) => {
  const [filas] = await db.query(
    'SELECT 1 FROM cliente_direccion WHERE id_cliente = ? AND id_direccion = ?',
    [idCliente, idDireccion]
  );
  if (!filas[0]) return false;


  await db.query(
    'UPDATE cliente_direccion SET es_principal = (id_direccion = ?) WHERE id_cliente = ?',
    [idDireccion, idCliente]
  );
  return true;
};
