// Modelo de los medios de pago disponibles (HU-030).
// Las opciones salen de la tabla "metodo_pago": si el administrador agrega o desactiva uno,
// el carrito lo refleja sin tocar código.
const db = require('../config/db');

// Medios activos, en orden de creación. Se usan para el selector del carrito.
exports.listarActivos = async () => {
  const [filas] = await db.query(
    'SELECT id_metodo AS id, nombre FROM metodo_pago WHERE activo = TRUE ORDER BY id_metodo'
  );
  return filas;
};

// ¿El medio existe y está activo? Se valida al confirmar: el navegador podría mandar cualquier id.
exports.obtenerActivo = async (id, conn = null) => {
  const [filas] = await (conn || db).query(
    'SELECT id_metodo AS id, nombre FROM metodo_pago WHERE id_metodo = ? AND activo = TRUE',
    [id]
  );
  return filas[0] || null;
};
