

const db = require('../config/db');


exports.guardar = async ({ nombre, correo, asunto, mensaje }) => {
  const [resultado] = await db.query(
    'INSERT INTO mensaje_contacto (nombre, correo, asunto, mensaje) VALUES (?, ?, ?, ?)',
    [nombre, correo, asunto, mensaje]
  );
  return resultado.insertId;
};


exports.listar = async () => {
  const [filas] = await db.query(
    `SELECT id_mensaje AS id, nombre, correo, asunto, mensaje, leido, creado_en
     FROM mensaje_contacto
     ORDER BY leido ASC, creado_en DESC, id_mensaje DESC`
  );
  return filas.map((f) => ({ ...f, leido: Boolean(f.leido) }));
};


exports.marcarLeido = async (id) => {
  const [resultado] = await db.query('UPDATE mensaje_contacto SET leido = TRUE WHERE id_mensaje = ?', [id]);
  return resultado.affectedRows > 0;
};


exports.sinLeer = async (limite = 5) => {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM mensaje_contacto WHERE leido = FALSE');
  const [ultimos] = await db.query(
    `SELECT id_mensaje AS id, nombre, correo, asunto, creado_en
     FROM mensaje_contacto WHERE leido = FALSE
     ORDER BY creado_en DESC, id_mensaje DESC LIMIT ?`,
    [limite]
  );
  return { total: Number(n), ultimos };
};
