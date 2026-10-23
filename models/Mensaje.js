// Modelo: mensajes del formulario de contacto (tabla mensaje_contacto).
// El panel de administración muestra los que no se han leído (HU-035).
// La HU-012 (formulario de contacto) agrega aquí la función para guardar un mensaje nuevo.
const db = require('../config/db');

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
