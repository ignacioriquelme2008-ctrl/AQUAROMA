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

// Opciones del filtro "Tipo" del catálogo (HU-015). Salen de la tabla tipo_agua, no van escritas
// a mano en la vista: si mañana se agrega un tipo de agua en la base, aparece solo en el filtro.
// Solo se listan los tipos activos que hoy tienen algún producto activo (los demás filtrarían vacío).
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

// Un producto activo con todos los datos de su ficha (HU-016): aroma, tipo de agua, presentación en ml y stock total.
// Devuelve null si no existe o está desactivado.
exports.obtenerPorId = async (id) => {
  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio,
            p.descripcion AS etiqueta, p.descripcion_larga, p.imagen,
            c.nombre AS aroma, t.nombre AS tipo,
            pr.volumen_ml, pr.tipo_envase,
            p.es_personalizable AS personalizable,
            COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     JOIN categoria c ON p.id_categoria = c.id_categoria
     JOIN tipo_agua t ON p.id_tipo_agua = t.id_tipo_agua
     JOIN presentacion pr ON p.id_presentacion = pr.id_presentacion
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     WHERE p.id_producto = ? AND p.activo = TRUE
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.descripcion, p.descripcion_larga, p.imagen,
               c.nombre, t.nombre, pr.volumen_ml, pr.tipo_envase, p.es_personalizable`,
    [id]
  );
  if (!filas[0]) return null;

  const f = filas[0];
  return { ...f, precio: Number(f.precio), stock: Number(f.stock), personalizable: Boolean(f.personalizable) };
};

// Aromas que se pueden elegir en la ficha de un producto personalizable (HU-018).
// El nombre y la descripción sensorial salen del componente activo en la base de datos.
exports.aromasDisponibles = async () => {
  const [filas] = await db.query(
    `SELECT id_componente AS id, nombre, descripcion
     FROM componente
     WHERE activo = TRUE AND tipo IN ('aroma', 'mixto')
     ORDER BY nombre, id_componente`
  );
  return filas;
};

// Comprueba una selección recibida por formulario: el producto debe permitir personalización
// y el componente debe ser un aroma activo. Nunca se confía en el nombre que mande el navegador.
exports.obtenerAromaParaProducto = async (idProducto, idComponente) => {
  const [filas] = await db.query(
    `SELECT c.id_componente AS id, c.nombre, c.descripcion
     FROM producto p
     JOIN componente c ON c.id_componente = ?
     WHERE p.id_producto = ? AND p.activo = TRUE AND p.es_personalizable = TRUE
       AND c.activo = TRUE AND c.tipo IN ('aroma', 'mixto')`,
    [idComponente, idProducto]
  );
  return filas[0] || null;
};

// Productos de un carrito [{ id, qty }] con los datos que muestra la página del carrito
// (HU-022 a HU-025): nombre, aroma, imagen, precio ACTUAL y stock total. Conserva el orden
// recibido y descarta los productos que ya no existen o fueron desactivados (HU-037).
exports.detallarCarrito = async (items) => {
  if (!items || items.length === 0) return [];

  const [filas] = await db.query(
    `SELECT p.id_producto AS id, p.nombre, p.precio_base AS precio, p.imagen,
            c.nombre AS aroma, COALESCE(SUM(i.cantidad), 0) AS stock
     FROM producto p
     JOIN categoria c ON c.id_categoria = p.id_categoria
     LEFT JOIN inventario i ON i.id_producto = p.id_producto
     WHERE p.activo = TRUE AND p.id_producto IN (?)
     GROUP BY p.id_producto, p.nombre, p.precio_base, p.imagen, c.nombre`,
    [items.map((i) => i.id)]
  );
  const porId = new Map(filas.map((f) => [f.id, f]));
  const idsComponentes = [...new Set(items.map((i) => i.idComponente).filter(Boolean))];
  let aromas = new Map();
  if (idsComponentes.length > 0) {
    const [componentes] = await db.query(
      `SELECT id_componente AS id, nombre, descripcion
       FROM componente WHERE tipo IN ('aroma', 'mixto') AND id_componente IN (?)`,
      [idsComponentes]
    );
    aromas = new Map(componentes.map((c) => [c.id, c]));
  }

  return items
    .filter((i) => porId.has(i.id))
    .map((i) => {
      const p = porId.get(i.id);
      const precio = Number(p.precio);
      const aromaElegido = i.idComponente ? aromas.get(i.idComponente) : null;
      return {
        id: p.id,
        nombre: p.nombre,
        aroma: aromaElegido ? aromaElegido.nombre : p.aroma,
        aromaElegido: aromaElegido ? aromaElegido.nombre : null,
        descripcionAroma: aromaElegido ? aromaElegido.descripcion : null,
        idComponente: aromaElegido ? aromaElegido.id : null,
        intensidad: aromaElegido ? Number(i.intensidad) || 1 : null,
        imagen: p.imagen,
        precio,
        stock: Number(p.stock),
        qty: i.qty,
        subtotal: precio * i.qty,
      };
    });
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

// ---------------------------------------------------------------------
// HU-037: editar, activar/desactivar y eliminar productos.
// ---------------------------------------------------------------------

// Un producto (activo o no) con los datos que usa el formulario de edición.
// "actualizado_en" es la fecha de última modificación: MySQL la pone sola en cada UPDATE.
exports.obtenerParaEditar = async (id) => {
  const [filas] = await db.query(
    `SELECT id_producto AS id, sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base,
            es_personalizable, descripcion, descripcion_larga, imagen, activo, creado_en, actualizado_en
     FROM producto WHERE id_producto = ?`,
    [id]
  );
  const f = filas[0];
  if (!f) return null;
  // Mismos nombres de campo que el formulario (los usa views/admin/producto-nuevo.ejs).
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

// Guarda los cambios del formulario. El SKU no se cambia: identifica al producto en los pedidos.
// También se actualiza el precio de su configuración base (la que usa el carrito, HU-026).
exports.actualizar = async (id, d) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE producto SET nombre = ?, id_tipo_agua = ?, id_presentacion = ?, id_categoria = ?, precio_base = ?,
              es_personalizable = ?, descripcion = ?, descripcion_larga = ?, imagen = ?, activo = ?
       WHERE id_producto = ?`,
      [d.nombre, d.idTipoAgua, d.idPresentacion, d.idCategoria, d.precio, d.esPersonalizable,
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

// Activa o desactiva un producto. Desactivado deja de verse en la tienda, pero sus pedidos,
// recetas y movimientos de inventario se conservan (criterio 2 de HU-037).
exports.cambiarActivo = async (id, activo) => {
  const [r] = await db.query('UPDATE producto SET activo = ? WHERE id_producto = ?', [activo, id]);
  return r.affectedRows > 0;
};

// ¿El producto aparece en algún pedido (también en un carrito guardado) o en una orden de producción?
// Si es así, no se puede borrar: se perdería el historial de ventas (criterio 3 de HU-037).
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

// Borra un producto que NUNCA se vendió, junto con lo que se creó con él (HU-036): su ficha de
// preparación, su configuración base, su stock y los movimientos de ese stock.
// El controlador revisa antes tienePedidos(); aquí se vuelve a revisar dentro de la transacción.
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
    await conn.query('DELETE FROM configuracion_bebida WHERE id_producto = ?', [id]);   // sus componentes se borran en cascada
    await conn.query('DELETE FROM formulacion WHERE id_producto = ?', [id]);            // sus insumos se borran en cascada
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
