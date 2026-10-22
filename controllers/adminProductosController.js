// Controlador de PRODUCTOS del panel de administración.
//   HU-036 (crear productos): listar, mostrarFormulario, crear.
//   HU-037 (editar y desactivar) puede agregar aquí sus funciones y reutilizar validarProducto().
// Las rutas están en routes/adminRoutes.js y exigen el permiso "gestionar_productos".
const fs = require('fs/promises');
const path = require('path');
const Producto = require('../models/Producto');
const { texto } = require('../utils/validaciones');

// Reglas de cada campo. Los largos coinciden con las columnas de la tabla producto.
const SKU_REGEX = /^[A-Z0-9-]{3,30}$/;            // ej.: AQ-LIM-500 (mayúsculas, números y guiones)
const LARGO = { nombre: 120, etiqueta: 40, descripcionLarga: 1000 };
const PRECIO_MAX = 99999999;                       // precio_base es DECIMAL(10,2): hasta 99.999.999
const STOCK_MAX = 99999;
const CARPETA_IMAGENES = path.join(__dirname, '..', 'public', 'img', 'productos');

// Imágenes que hay en public/img/productos. Para usar una imagen nueva, se copia a esa carpeta
// y aparece sola en la lista del formulario.
async function imagenesDisponibles() {
  const archivos = await fs.readdir(CARPETA_IMAGENES);
  return archivos.filter((a) => /\.(png|jpe?g|webp)$/i.test(a)).sort();
}

// Convierte "1.490" o "1490" en 1490. Devuelve NaN si no es un número entero.
function entero(valor) {
  const limpio = texto(valor).trim().replace(/\./g, '');
  return /^-?\d+$/.test(limpio) ? Number(limpio) : NaN;
}

// Lee y valida el formulario. Devuelve { datos, errores }; errores = { campo: 'mensaje' }.
// "opciones" son las listas válidas de la base, para que nadie mande un id inventado.
function validarProducto(body, opciones, imagenes) {
  const datos = {
    sku: texto(body.sku).trim().toUpperCase(),
    nombre: texto(body.nombre).trim(),
    idTipoAgua: Number(body.idTipoAgua),
    idPresentacion: Number(body.idPresentacion),
    idCategoria: Number(body.idCategoria),
    precioTexto: texto(body.precio).trim(),
    precio: entero(body.precio),
    esPersonalizable: body.esPersonalizable === '1',
    etiqueta: texto(body.etiqueta).trim(),
    descripcionLarga: texto(body.descripcionLarga).trim(),
    imagen: texto(body.imagen),
    activo: body.activo === '1',
    stockTexto: texto(body.stockInicial).trim(),
    stockInicial: texto(body.stockInicial).trim() === '' ? 0 : entero(body.stockInicial),
    idSucursal: Number(body.idSucursal),
  };
  const errores = {};
  const existe = (lista, id) => lista.some((o) => o.id === id);

  if (!datos.sku) errores.sku = 'Ingresa el código SKU.';
  else if (!SKU_REGEX.test(datos.sku)) errores.sku = 'El SKU debe tener de 3 a 30 caracteres: letras, números y guiones (ej.: AQ-MAN-500).';

  if (!datos.nombre) errores.nombre = 'Ingresa el nombre del producto.';
  else if (datos.nombre.length > LARGO.nombre) errores.nombre = `El nombre puede tener hasta ${LARGO.nombre} caracteres.`;

  if (!existe(opciones.tipos, datos.idTipoAgua)) errores.idTipoAgua = 'Elige el tipo de agua.';
  if (!existe(opciones.presentaciones, datos.idPresentacion)) errores.idPresentacion = 'Elige la presentación.';
  if (!existe(opciones.categorias, datos.idCategoria)) errores.idCategoria = 'Elige la categoría (aroma).';

  if (!datos.precioTexto) errores.precio = 'Ingresa el precio.';
  else if (Number.isNaN(datos.precio)) errores.precio = 'El precio debe ser un número entero en pesos, sin decimales (ej.: 1490).';
  else if (datos.precio < 0) errores.precio = 'El precio no puede ser negativo.';
  else if (datos.precio === 0) errores.precio = 'El precio debe ser mayor que 0.';
  else if (datos.precio > PRECIO_MAX) errores.precio = 'El precio es demasiado alto.';

  if (!datos.etiqueta) errores.etiqueta = 'Ingresa una descripción corta (se muestra en la tarjeta del catálogo).';
  else if (datos.etiqueta.length > LARGO.etiqueta) errores.etiqueta = `La descripción corta puede tener hasta ${LARGO.etiqueta} caracteres.`;
  if (datos.descripcionLarga.length > LARGO.descripcionLarga) errores.descripcionLarga = `La descripción puede tener hasta ${LARGO.descripcionLarga} caracteres.`;

  if (!imagenes.includes(datos.imagen)) errores.imagen = 'Elige la imagen del producto.';

  if (Number.isNaN(datos.stockInicial)) errores.stockInicial = 'El stock debe ser un número entero.';
  else if (datos.stockInicial < 0) errores.stockInicial = 'El stock no puede ser negativo.';
  else if (datos.stockInicial > STOCK_MAX) errores.stockInicial = `El stock inicial puede ser hasta ${STOCK_MAX} unidades.`;
  else if (datos.stockInicial > 0 && !existe(opciones.sucursales, datos.idSucursal)) errores.idSucursal = 'Elige la sucursal donde queda el stock.';

  return { datos, errores };
}

// Junta lo que necesita la vista del formulario (listas desplegables + imágenes) y la muestra.
async function mostrarVistaFormulario(res, estado, datos, errores) {
  const [opciones, imagenes] = await Promise.all([Producto.opcionesFormulario(), imagenesDisponibles()]);
  res.status(estado).render('admin/producto-nuevo', { opciones, imagenes, datos, errores });
}

// GET /admin/productos -> tabla con todos los productos.
exports.listar = async (req, res, next) => {
  try {
    const productos = await Producto.listarParaAdmin();
    // ?creado=15 llega después de crear un producto: se muestra el aviso de éxito con su enlace.
    const creado = productos.find((p) => p.id === Number(req.query.creado)) || null;
    res.render('admin/productos', { productos, creado });
  } catch (err) {
    next(err);
  }
};

// GET /admin/productos/nuevo -> formulario vacío (producto activo y personalizable por defecto).
exports.mostrarFormulario = async (req, res, next) => {
  try {
    await mostrarVistaFormulario(res, 200, { activo: true, esPersonalizable: true }, {});
  } catch (err) {
    next(err);
  }
};

// POST /admin/productos -> valida y, si todo está bien, pide al modelo crear el producto.
exports.crear = async (req, res, next) => {
  try {
    const [opciones, imagenes] = await Promise.all([Producto.opcionesFormulario(), imagenesDisponibles()]);
    const { datos, errores } = validarProducto(req.body, opciones, imagenes);

    // Criterio 2 de HU-036: un SKU repetido se rechaza indicando el campo.
    if (!errores.sku && (await Producto.skuExiste(datos.sku))) errores.sku = 'Ya existe un producto con este SKU.';
    if (Object.keys(errores).length > 0) {
      return res.status(400).render('admin/producto-nuevo', { opciones, imagenes, datos, errores });
    }

    const id = await Producto.crear(datos, req.session.usuario.id);
    // Se redirige (patrón PRG) para que recargar la página no cree el producto dos veces.
    res.redirect('/admin/productos?creado=' + id);
  } catch (err) {
    // Si dos administradores guardan el mismo SKU a la vez, lo detiene la base (UNIQUE).
    if (err.code === 'ER_DUP_ENTRY') {
      try {
        const { datos } = validarProducto(req.body, await Producto.opcionesFormulario(), await imagenesDisponibles());
        return await mostrarVistaFormulario(res, 400, datos, { sku: 'Ya existe un producto con este SKU.' });
      } catch (e) {
        return next(e);
      }
    }
    next(err);
  }
};

exports.validarProducto = validarProducto;   // para reutilizarlo en HU-037 (editar)
