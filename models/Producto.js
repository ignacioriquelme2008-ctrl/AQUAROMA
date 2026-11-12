const db = require('../config/db');
const ventas = require('../config/ventas');
const { STOCK_POR_PRODUCTO } = require('../utils/stockVenta');

const slug = (texto) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');

exports.obtenerTodos = async () => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(MAX(i.stock), 0) AS stock
     FROM producto p
     JOIN categoria c ON p.id_categoria = c.id_categoria
     JOIN tipo_agua t ON p.id_tipo_agua = t.id_tipo_agua
     LEFT JOIN (${STOCK_POR_PRODUCTO}) i ON i.id_producto = p.id_producto
     WHERE p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.descripcion, p.imagen, c.nombre, t.nombre
     ORDER BY p.id_producto`
  );

  return filas.map((f) => ({
    ...f,
    precio: Number(f.precio),
    stock: Number(f.stock),
    aromaSlug: slug(f.aroma),
    tipoSlug: slug(f.tipo),
  }));
};

exports.tiposConProductos = async () => {
  const [filas] = await db.query(
    `SELECT DISTINCT t.id_tipo_agua AS id, t.nombre
     FROM tipo_agua t
     JOIN producto p ON p.id_tipo_agua = t.id_tipo_agua AND p.activo = TRUE
     WHERE t.activo = TRUE
     ORDER BY t.id_tipo_agua`
  );
  return filas.map((f) => ({ id: f.id, nombre: f.nombre, slug: slug(f.nombre) }));
};

exports.obtenerPorId = async (id) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.descripcion_larga, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            pr.volumen_ml, pr.tipo_envase,
            p.es_personalizable AS personalizable,
            COALESCE(MAX(i.stock), 0) AS stock
     FROM producto p
     JOIN categoria c ON p.id_categoria = c.id_categoria
     JOIN tipo_agua t ON p.id_tipo_agua = t.id_tipo_agua
     JOIN presentacion pr ON p.id_presentacion = pr.id_presentacion
     LEFT JOIN (${STOCK_POR_PRODUCTO}) i ON i.id_producto = p.id_producto
     WHERE p.id_producto = ? AND p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.descripcion, p.descripcion_larga, p.imagen,
               c.nombre, t.nombre, pr.volumen_ml, pr.tipo_envase, p.es_personalizable`,
    [id]
  );
  if (!filas[0]) return null;

  const f = filas[0];
  return { ...f, precio: Number(f.precio), stock: Number(f.stock), personalizable: Boolean(f.personalizable) };
};

exports.aromasDisponibles = async () => {
  const [filas] = await db.query(
     `SELECT id_componente AS id, nombre, descripcion, recargo_precio AS recargoPorDosis
     FROM componente
     WHERE activo = TRUE AND tipo IN ('aroma', 'mixto')
     ORDER BY nombre, id_componente`
  );
  return filas.map((f) => ({ ...f, recargoPorDosis: Number(f.recargoPorDosis) }));
};

exports.obtenerAromaParaProducto = async (idProducto, idComponente) => {
  const [filas] = await db.query(
    `SELECT c.id_componente AS id, c.nombre, c.descripcion, c.recargo_precio AS recargoPorDosis
     FROM producto p
     JOIN componente c ON c.id_componente = ?
     WHERE p.id_producto = ? AND p.activo = TRUE AND p.es_personalizable = TRUE
       AND c.activo = TRUE AND c.tipo IN ('aroma', 'mixto')`,
    [idComponente, idProducto]
  );
  return filas[0] ? { ...filas[0], recargoPorDosis: Number(filas[0].recargoPorDosis) } : null;
};

exports.detallarCarrito = async (items) => {
  if (!items || items.length === 0) return [];

  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio, p.imagen,
            c.nombre AS aroma, COALESCE(MAX(i.stock), 0) AS stock
     FROM producto p
     JOIN categoria c ON c.id_categoria = p.id_categoria
     LEFT JOIN (${STOCK_POR_PRODUCTO}) i ON i.id_producto = p.id_producto
     WHERE p.activo = TRUE AND p.id_producto IN (?)
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.imagen, c.nombre`,
    [items.map((i) => i.id)]
  );
  const porId = new Map(filas.map((f) => [f.id, f]));
  const idsComponentes = [...new Set(items.map((i) => i.idComponente).filter(Boolean))];
  let aromas = new Map();
  if (idsComponentes.length > 0) {
    const [componentes] = await db.query(
      `SELECT id_componente AS id, nombre, descripcion, recargo_precio AS recargoPorDosis
       FROM componente WHERE tipo IN ('aroma', 'mixto') AND id_componente IN (?)`,
      [idsComponentes]
    );
    aromas = new Map(componentes.map((c) => [c.id, { ...c, recargoPorDosis: Number(c.recargoPorDosis) }]));
  }

  return items
    .filter((i) => porId.has(i.id))
    .map((i) => {
      const p = porId.get(i.id);
      const aromaElegido = i.idComponente ? aromas.get(i.idComponente) : null;
      const intensidad = aromaElegido ? Number(i.intensidad) || 1 : null;
      const precioBase = Number(p.precio);
      const recargoPorDosis = aromaElegido ? aromaElegido.recargoPorDosis : 0;
      const precio = aromaElegido ? ventas.precioPersonalizado(precioBase, intensidad, recargoPorDosis) : precioBase;
      return {
        id: p.id,
        nombre: p.nombre,
        aroma: aromaElegido ? aromaElegido.nombre : p.aroma,
        aromaElegido: aromaElegido ? aromaElegido.nombre : null,
        descripcionAroma: aromaElegido ? aromaElegido.descripcion : null,
        idComponente: aromaElegido ? aromaElegido.id : null,
        intensidad,
        recargoPorDosis,
        imagen: p.imagen,
        precioBase,
        recargo: precio - precioBase,
        precio,
        stock: Number(p.stock),
        qty: i.qty,
        subtotal: precio * i.qty,
      };
    });
};

const ordenDestacados = new Map([
  ['AQ-NAR-500', 0],
  ['AQ-LIM-500', 1],
  ['AQ-MEN-500', 2],
]);

exports.obtenerDestacados = async (limite = 3) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(s.stock, 0) AS stock,
            COALESCE(v.unidades, 0) AS vendidas, p.sku
     FROM producto p
     JOIN categoria c ON c.id_categoria = p.id_categoria
     JOIN tipo_agua t ON t.id_tipo_agua = p.id_tipo_agua
     LEFT JOIN (${STOCK_POR_PRODUCTO}) s ON s.id_producto = p.id_producto
     LEFT JOIN (SELECT cb.id_producto, SUM(dp.cantidad) AS unidades
                FROM detalle_pedido dp
                JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
                JOIN pedido pe ON pe.id_pedido = dp.id_pedido
                WHERE pe.estado IN ('pagado','preparando','enviado','entregado')
                GROUP BY cb.id_producto) v ON v.id_producto = p.id_producto
     WHERE p.activo = TRUE`
  );

  const productos = filas.map((f) => ({
    ...f,
    precio: Number(f.precio),
    stock: Number(f.stock),
    vendidas: Number(f.vendidas),
    aromaSlug: slug(f.aroma),
    tipoSlug: slug(f.tipo),
  }));

  const maxVentas = Math.max(0, ...productos.map((p) => p.vendidas));
  productos.forEach((p) => { p.masVendido = maxVentas > 0 && p.vendidas === maxVentas; });

  const prioridad = (producto) => ordenDestacados.get(producto.sku) ?? ordenDestacados.size;
  productos.sort((a, b) => prioridad(a) - prioridad(b)
    || (b.stock > 0) - (a.stock > 0) || b.vendidas - a.vendidas || a.id - b.id);
  return productos.slice(0, limite);
};


exports.listarParaAdmin = async () => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.sku, p.nombre, p.precio_base AS precio, p.activo, p.actualizado_en,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
     JOIN tipo_agua t ON t.id_tipo_agua = p.id_tipo_agua
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     GROUP BY p.id_producto, p.sku, p.nombre, p.precio_base, p.activo, p.actualizado_en, c.nombre, t.nombre
     ORDER BY p.id_producto DESC`
  );
  return filas.map((f) => ({ ...f, precio: Number(f.precio), stock: Number(f.stock), activo: Boolean(f.activo) }));
};

exports.opcionesFormulario = async () => {
  const [tipos] = await db.query('SELECT id_tipo_agua AS id, nombre FROM tipo_agua WHERE activo = TRUE ORDER BY nombre');
  const [presentaciones] = await db.query(
    'SELECT id_presentacion AS id, nombre, volumen_ml, tipo_envase FROM presentacion WHERE activo = TRUE ORDER BY volumen_ml');
  const [categorias] = await db.query('SELECT id_categoria AS id, nombre FROM categoria WHERE activo = TRUE ORDER BY nombre');
  const [sucursales] = await db.query('SELECT id_sucursal AS id, nombre FROM sucursal WHERE activo = TRUE ORDER BY id_sucursal');
  return { tipos, presentaciones, categorias, sucursales };
};

exports.skuExiste = async (sku) => {
  const [filas] = await db.query('SELECT 1 FROM producto WHERE sku = ? LIMIT 1', [sku]);
  return filas.length > 0;
};

async function resolverCategoria(conn, datos) {
  if (!datos.categoriaNueva) return datos.idCategoria;
  const [categoria] = await conn.query(
    `INSERT INTO categoria (nombre, activo) VALUES (?, TRUE)
     ON DUPLICATE KEY UPDATE id_categoria = LAST_INSERT_ID(id_categoria), activo = TRUE`,
    [datos.nombreCategoriaNueva]
  );
  await conn.query(
    `INSERT INTO componente (nombre, tipo, unidad_dosificacion, recargo_precio, activo)
     VALUES (?, 'mixto', 'dosis', 0, TRUE)
     ON DUPLICATE KEY UPDATE activo = TRUE`,
    [datos.nombreCategoriaNueva]
  );
  return categoria.insertId;
}

exports.crear = async (d, idUsuario) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const idCategoria = await resolverCategoria(conn, d);

    const [nuevo] = await conn.query(
      `INSERT INTO producto (sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base,
                             es_personalizable, descripcion, descripcion_larga, imagen, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.sku, d.nombre, d.idTipoAgua, d.idPresentacion, idCategoria, d.precio,
       d.esPersonalizable, d.etiqueta, d.descripcionLarga || null, d.imagen, d.activo]
    );
    const idProducto = nuevo.insertId;

    await conn.query(
      `INSERT INTO formulacion (id_producto, version, vigente) VALUES (?, '1.0', TRUE)`, [idProducto]);

    await conn.query(
      `INSERT INTO configuracion_bebida (id_producto, id_cliente, nombre_display, precio_final, es_plantilla_global)
       VALUES (?, NULL, ?, ?, TRUE)`,
      [idProducto, d.nombre, d.precio]
    );

    if (d.stockInicial > 0) {
      await conn.query(
        'INSERT INTO inventario (id_sucursal, id_producto, cantidad) VALUES (?, ?, ?)',
        [d.idSucursal, idProducto, d.stockInicial]
      );
      await conn.query(
        `INSERT INTO movimiento_inventario (id_sucursal, id_producto, tipo, cantidad, tipo_origen, id_usuario, observacion)
         VALUES (?, ?, 'ajuste', ?, 'ajuste_manual', ?, 'Stock inicial al crear el producto (HU-036)')`,
        [d.idSucursal, idProducto, d.stockInicial, idUsuario]
      );
    }

    await conn.commit();
    return idProducto;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};


exports.obtenerParaEditar = async (id) => {
  const [filas] = await db.query(
    `SELECT id_producto AS id, sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base,
            es_personalizable, descripcion, descripcion_larga, imagen, activo, creado_en, actualizado_en
     FROM producto WHERE id_producto = ?`,
    [id]
  );
  const f = filas[0];
  if (!f) return null;
  return {
    id: f.id,
    sku: f.sku,
    nombre: f.nombre,
    idTipoAgua: f.id_tipo_agua,
    idPresentacion: f.id_presentacion,
    idCategoria: f.id_categoria,
    precioTexto: String(Number(f.precio_base)),
    esPersonalizable: Boolean(f.es_personalizable),
    etiqueta: f.descripcion || '',
    descripcionLarga: f.descripcion_larga || '',
    imagen: f.imagen,
    activo: Boolean(f.activo),
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  };
};

exports.actualizar = async (id, d) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const idCategoria = await resolverCategoria(conn, d);
    await conn.query(
      `UPDATE producto SET nombre = ?, id_tipo_agua = ?, id_presentacion = ?, id_categoria = ?, precio_base = ?,
              es_personalizable = ?, descripcion = ?, descripcion_larga = ?, imagen = ?, activo = ?
       WHERE id_producto = ?`,
      [d.nombre, d.idTipoAgua, d.idPresentacion, idCategoria, d.precio, d.esPersonalizable,
       d.etiqueta, d.descripcionLarga || null, d.imagen, d.activo, id]
    );
    await conn.query(
      `UPDATE configuracion_bebida SET nombre_display = ?, precio_final = ?
       WHERE id_producto = ? AND es_plantilla_global = TRUE AND id_cliente IS NULL`,
      [d.nombre, d.precio, id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.cambiarActivo = async (id, activo) => {
  const [r] = await db.query('UPDATE producto SET activo = ? WHERE id_producto = ?', [activo, id]);
  return r.affectedRows > 0;
};

exports.tienePedidos = async (id) => {
  const [filas] = await db.query(
    `SELECT 1 FROM detalle_pedido dp
     JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
     WHERE cb.id_producto = ?
     UNION ALL
     SELECT 1 FROM detalle_orden_produccion WHERE id_producto = ?
     LIMIT 1`,
    [id, id]
  );
  return filas.length > 0;
};

exports.eliminar = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [usado] = await conn.query(
      `SELECT 1 FROM detalle_pedido dp JOIN configuracion_bebida cb ON cb.id_configuracion = dp.id_configuracion
       WHERE cb.id_producto = ? LIMIT 1`,
      [id]
    );
    if (usado.length > 0) {
      const err = new Error('El producto tiene pedidos asociados.');
      err.code = 'PRODUCTO_CON_PEDIDOS';
      throw err;
    }
    await conn.query('DELETE FROM configuracion_bebida WHERE id_producto = ?', [id]);
    await conn.query('DELETE FROM formulacion WHERE id_producto = ?', [id]);
    await conn.query('DELETE FROM movimiento_inventario WHERE id_producto = ?', [id]);
    await conn.query('DELETE FROM inventario WHERE id_producto = ?', [id]);
    const [r] = await conn.query('DELETE FROM producto WHERE id_producto = ?', [id]);
    await conn.commit();
    return r.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
