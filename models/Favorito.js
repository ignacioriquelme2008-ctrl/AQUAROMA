// Modelo de configuraciones favoritas del cliente (HU-021).
//
// Una "favorita" es una preparación personalizada (producto + aroma + intensidad) que el cliente
// guardó con un nombre propio. La preparación NO se duplica: se reutiliza la fila de
// configuracion_bebida que ya crea el carrito (models/Carrito.js) y aquí solo se guarda el alias.
// Todo se filtra SIEMPRE por id_cliente: una favorita nunca se lee ni se borra por su id solo.
const db = require('../config/db');
const { STOCK_POR_PRODUCTO } = require('../utils/stockVenta');

// Consulta base: la favorita, su preparación, su producto y el stock total del producto.
// El aroma y la intensidad viven en configuracion_componente (cantidad = dosis de aroma).
const BASE = `
  SELECT f.id_favorita AS id, f.alias, f.creado_en,
         cb.id_configuracion AS idConfiguracion,
         p.id_producto AS idProducto, p.nombre AS producto, p.imagen,
         p.precio_base AS precio, p.activo,
         MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN c.nombre END) AS aroma,
         MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.id_componente END) AS idComponente,
         MAX(CASE WHEN c.tipo IN ('aroma', 'mixto') THEN cc.cantidad END) AS intensidad,
         COALESCE(s.stock, 0) AS stock
  FROM configuracion_favorita f
  JOIN configuracion_bebida cb ON cb.id_configuracion = f.id_configuracion
  JOIN producto p ON p.id_producto = cb.id_producto
  LEFT JOIN configuracion_componente cc ON cc.id_configuracion = cb.id_configuracion
  LEFT JOIN componente c ON c.id_componente = cc.id_componente
  LEFT JOIN (${STOCK_POR_PRODUCTO}) s ON s.id_producto = p.id_producto`;

const AGRUPAR = `
  GROUP BY f.id_favorita, f.alias, f.creado_en, f.id_configuracion, p.id_producto,
           p.nombre, p.imagen, p.precio_base, p.activo, s.stock`;

// Filas de la base con los nombres que usan las vistas y el controlador.
const aFavorita = (f) => {
  const stock = Number(f.stock);
  return {
    id: f.id,
    alias: f.alias,
    idConfiguracion: f.idConfiguracion,
    idProducto: f.idProducto,
    producto: f.producto,
    imagen: f.imagen,
    aroma: f.aroma || null,
    idComponente: f.idComponente || null,
    intensidad: f.idComponente ? Number(f.intensidad) : null,
    precio: Number(f.precio),
    stock,
    // Solo se puede pedir de nuevo si el producto sigue activo y hay stock en alguna sucursal.
    disponible: Boolean(f.activo) && stock > 0,
  };
};

// Todas las favoritas del cliente, de la más nueva a la más antigua (criterio 2).
exports.listarDeCliente = async (idCliente) => {
  const [filas] = await db.query(
    `${BASE} WHERE f.id_cliente = ? ${AGRUPAR} ORDER BY f.creado_en DESC, f.id_favorita DESC`,
    [idCliente]
  );
  return filas.map(aFavorita);
};

// Una favorita del cliente. Devuelve null si no existe o es de otra persona (evita IDOR).
exports.obtenerDeCliente = async (idCliente, idFavorita) => {
  const [filas] = await db.query(
    `${BASE} WHERE f.id_cliente = ? AND f.id_favorita = ? ${AGRUPAR}`,
    [idCliente, idFavorita]
  );
  return filas[0] ? aFavorita(filas[0]) : null;
};

// Guarda una favorita nueva (criterio 1). El INSERT ... SELECT comprueba en la misma consulta
// que la configuración sea de este cliente y sea personalizada: nadie puede marcar como suya
// una preparación ajena cambiando el id en la petición.
// Devuelve el id de la favorita, o null si la configuración no era válida.
exports.crear = async (idCliente, idConfiguracion, alias) => {
  const [r] = await db.query(
    `INSERT INTO configuracion_favorita (id_cliente, id_configuracion, alias)
     SELECT ?, cb.id_configuracion, ?
     FROM configuracion_bebida cb
     WHERE cb.id_configuracion = ? AND cb.id_cliente = ? AND cb.es_plantilla_global = FALSE`,
    [idCliente, alias, idConfiguracion, idCliente]
  );
  return r.affectedRows > 0 ? r.insertId : null;
};

// Quita una favorita del cliente. La preparación (configuracion_bebida) NO se borra: puede estar
// usada por pedidos anteriores. Devuelve false si no existía o era de otra persona.
exports.eliminar = async (idCliente, idFavorita) => {
  const [r] = await db.query(
    'DELETE FROM configuracion_favorita WHERE id_cliente = ? AND id_favorita = ?',
    [idCliente, idFavorita]
  );
  return r.affectedRows > 0;
};
