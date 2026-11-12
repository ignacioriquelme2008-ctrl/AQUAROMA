





const db = require('../config/db');
const { STOCK_POR_PRODUCTO } = require('../utils/stockVenta');



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

    disponible: Boolean(f.activo) && stock > 0,
  };
};


exports.listarDeCliente = async (idCliente) => {
  const [filas] = await db.query(
    `${BASE} WHERE f.id_cliente = ? ${AGRUPAR} ORDER BY f.creado_en DESC, f.id_favorita DESC`,
    [idCliente]
  );
  return filas.map(aFavorita);
};


exports.obtenerDeCliente = async (idCliente, idFavorita) => {
  const [filas] = await db.query(
    `${BASE} WHERE f.id_cliente = ? AND f.id_favorita = ? ${AGRUPAR}`,
    [idCliente, idFavorita]
  );
  return filas[0] ? aFavorita(filas[0]) : null;
};





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



exports.eliminar = async (idCliente, idFavorita) => {
  const [r] = await db.query(
    'DELETE FROM configuracion_favorita WHERE id_cliente = ? AND id_favorita = ?',
    [idCliente, idFavorita]
  );
  return r.affectedRows > 0;
};
