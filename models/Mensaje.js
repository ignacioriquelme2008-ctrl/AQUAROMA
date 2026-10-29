// Modelo: mensajes del formulario de contacto (tabla mensaje_contacto).
// Guarda mensajes del formulario HU-012 y permite que el equipo los lea desde administración.
const db = require('../config/db');

// Guarda un mensaje validado por el controlador con una consulta parametrizada.
exports.guardar = async ({ nombre, correo, asunto, mensaje }) => {
  const [resultado] = await db.query(
    'INSERT INTO mensaje_contacto (nombre, correo, asunto, mensaje) VALUES (?, ?, ?, ?)',
    [nombre, correo, asunto, mensaje]
  );
  return resultado.insertId;
};

// Mensajes completos para el módulo administrativo (HU-012 criterio 4).
exports.listar = async () => {
  const [filas] = await db.query(
    `SELECT id_mensaje AS id, nombre, correo, asunto, mensaje, leido, creado_en
     FROM mensaje_contacto
     ORDER BY leido ASC, creado_en DESC, id_mensaje DESC`
  );
  return filas.map((f) => ({ ...f, leido: Boolean(f.leido) }));
};

// Marca como leído un mensaje desde el panel.
exports.marcarLeido = async (id) => {
  const [resultado] = await db.query('UPDATE mensaje_contacto SET leido = TRUE WHERE id_mensaje = ?', [id]);
  return resultado.affectedRows > 0;
};

// Cantidad de mensajes sin leer y los más recientes de ellos.
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
