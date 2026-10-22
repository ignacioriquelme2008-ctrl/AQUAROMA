// Modelo: consultas SQL de productos (MySQL)
const db = require('../config/db');

// Convierte "Sin gas" en "sin-gas" y "Arándano" en "arandano" (para los filtros)
const slug = (texto) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');

exports.obtenerTodos = async () => {
  // Une cada producto con su categoría y tipo, suma su stock y trae su imagen para el catálogo.
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     JOIN categoria c ON p.id_categoria = c.id_categoria
     JOIN tipo_agua t ON p.id_tipo_agua = t.id_tipo_agua
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     WHERE p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.descripcion, p.imagen, c.nombre, t.nombre
     ORDER BY p.id_producto`
  );

  // MySQL entrega los DECIMAL como texto ("1490.00"): los pasamos a número
  return filas.map((f) => ({
    ...f,
    precio: Number(f.precio),
    stock: Number(f.stock),
    aromaSlug: slug(f.aroma),
    tipoSlug: slug(f.tipo),
  }));
};

// Un producto activo con todos los datos de su ficha (HU-016): aroma, tipo de agua, presentación en ml y stock total.
// Devuelve null si no existe o está desactivado.
exports.obtenerPorId = async (id) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.descripcion_larga, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            pr.volumen_ml, pr.tipo_envase,
            COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     JOIN categoria c ON p.id_categoria = c.id_categoria
     JOIN tipo_agua t ON p.id_tipo_agua = t.id_tipo_agua
     JOIN presentacion pr ON p.id_presentacion = pr.id_presentacion
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     WHERE p.id_producto = ? AND p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.descripcion, p.descripcion_larga, p.imagen,
              c.nombre, t.nombre, pr.volumen_ml, pr.tipo_envase`,
    [id]
  );
  if (!filas[0]) return null;

  const f = filas[0];
  return { ...f, precio: Number(f.precio), stock: Number(f.stock) };
};

// Productos destacados del inicio: solo activos, disponibles primero y luego los más vendidos
exports.obtenerDestacados = async (limite = 3) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(s.stock, 0) AS stock,
            COALESCE(v.unidades, 0) AS vendidas
     FROM producto p
     JOIN categoria c ON c.id_categoria = p.id_categoria
     JOIN tipo_agua t ON t.id_tipo_agua = p.id_tipo_agua
     LEFT JOIN (SELECT id_producto, SUM(cantidad) AS stock
                FROM inventario WHERE id_producto IS NOT NULL
                GROUP BY id_producto) s ON s.id_producto = p.id_producto
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

  // "Más vendido" = el producto con más unidades en pedidos reales (si hay alguna venta)
  const maxVentas = Math.max(0, ...productos.map((p) => p.vendidas));
  productos.forEach((p) => { p.masVendido = maxVentas > 0 && p.vendidas === maxVentas; });

  // Disponibles primero, luego por ventas, luego por orden
  productos.sort((a, b) => (b.stock > 0) - (a.stock > 0) || b.vendidas - a.vendidas || a.id - b.id);
  return productos.slice(0, limite);
};

// =====================================================================
// ADMINISTRACIÓN DE PRODUCTOS (HU-036). Las usa controllers/adminProductosController.js.
// HU-037 (editar y desactivar) puede agregar aquí sus consultas siguiendo el mismo estilo.
// =====================================================================

// Todos los productos (activos e inactivos) para la tabla del panel, con su stock total.
exports.listarParaAdmin = async () => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.sku, p.nombre, p.precio_base AS precio, p.activo,
            c.nombre AS aroma, t.nombre AS tipo,
            COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
     JOIN tipo_agua t ON t.id_tipo_agua = p.id_tipo_agua
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     GROUP BY p.id_producto, p.sku, p.nombre, p.precio_base, p.activo, c.nombre, t.nombre
     ORDER BY p.id_producto DESC`
  );
  return filas.map((f) => ({ ...f, precio: Number(f.precio), stock: Number(f.stock), activo: Boolean(f.activo) }));
};

// Opciones de las listas desplegables del formulario: solo las que están activas en la base.
// Así, si mañana se agrega un tipo de agua o un aroma en la base, aparece solo en el formulario.
exports.opcionesFormulario = async () => {
  const [tipos] = await db.query('SELECT id_tipo_agua AS id, nombre FROM tipo_agua WHERE activo = TRUE ORDER BY nombre');
  const [presentaciones] = await db.query(
    'SELECT id_presentacion AS id, nombre, volumen_ml, tipo_envase FROM presentacion WHERE activo = TRUE ORDER BY volumen_ml');
  const [categorias] = await db.query('SELECT id_categoria AS id, nombre FROM categoria WHERE activo = TRUE ORDER BY nombre');
  const [sucursales] = await db.query('SELECT id_sucursal AS id, nombre FROM sucursal WHERE activo = TRUE ORDER BY id_sucursal');
  return { tipos, presentaciones, categorias, sucursales };
};

// ¿Ya hay un producto con ese SKU? (la columna sku es UNIQUE: no se puede repetir).
exports.skuExiste = async (sku) => {
  const [filas] = await db.query('SELECT 1 FROM producto WHERE sku = ? LIMIT 1', [sku]);
  return filas.length > 0;
};

// Crea un producto nuevo (HU-036). Todo va en una TRANSACCIÓN: si un paso falla, se deshacen
// todos y no queda un producto a medias en la base.
//   1. producto: los datos del formulario.
//   2. formulacion: la "ficha inicial de preparación" (versión 1.0, vigente). Los insumos de la
//      receta (formulacion_insumo) se agregan después, cuando se defina cómo se prepara.
//   3. configuracion_bebida: la configuración base que usa el carrito para guardar el producto (HU-026).
//   4. Si se indicó stock inicial: inventario de la sucursal + un movimiento de "ajuste" que deja
//      registrado quién lo cargó (así el stock nunca aparece sin explicación).
// Devuelve el id del producto creado.
exports.crear = async (d, idUsuario) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [nuevo] = await conn.query(
      `INSERT INTO producto (sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base,
                             es_personalizable, descripcion, descripcion_larga, imagen, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.sku, d.nombre, d.idTipoAgua, d.idPresentacion, d.idCategoria, d.precio,
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
    conn.release();   // devuelve la conexión al pool, pase lo que pase
  }
};
