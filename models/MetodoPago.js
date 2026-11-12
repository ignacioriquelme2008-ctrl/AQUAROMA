


const db = require('../config/db');


exports.listarActivos = async () => {
  const [filas] = await db.query(
    'SELECT id_metodo AS id, nombre FROM metodo_pago WHERE activo = TRUE ORDER BY id_metodo'
  );
  return filas;
};


exports.obtenerActivo = async (id, conn = null) => {
  const [filas] = await (conn || db).query(
    'SELECT id_metodo AS id, nombre FROM metodo_pago WHERE id_metodo = ? AND activo = TRUE',
    [id]
  );
  return filas[0] || null;
};
