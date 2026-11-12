



const fs = require('fs/promises');
const path = require('path');
const Producto = require('../models/Producto');
const { texto } = require('../utils/validaciones');


const SKU_REGEX = /^[A-Z0-9-]{3,30}$/;
const LARGO = { nombre: 120, etiqueta: 40, descripcionLarga: 1000 };
const PRECIO_MAX = 99999999;
const STOCK_MAX = 99999;
const CARPETA_IMAGENES = path.join(__dirname, '..', 'public', 'img', 'productos');


async function imagenesDisponibles() {
  const archivos = await fs.readdir(CARPETA_IMAGENES);
  return archivos.filter((a) => /\.(png|jpe?g|webp)$/i.test(a)).sort();
}


function entero(valor) {
  const limpio = texto(valor).trim().replace(/\./g, '');
  return /^-?\d+$/.test(limpio) ? Number(limpio) : NaN;
}



function validarProducto(body, opciones, imagenes, archivo = null, errorImagen = null) {
  const datos = {
    sku: texto(body.sku).trim().toUpperCase(),
    nombre: texto(body.nombre).trim(),
    idTipoAgua: Number(body.idTipoAgua),
    idPresentacion: Number(body.idPresentacion),
    idCategoria: Number(body.idCategoria),
    categoriaNueva: body.idCategoria === 'nueva',
    nombreCategoriaNueva: texto(body.nombreCategoriaNueva).trim().replace(/\s+/g, ' '),
    precioTexto: texto(body.precio).trim(),
    precio: entero(body.precio),
    esPersonalizable: body.esPersonalizable === '1',
    etiqueta: texto(body.etiqueta).trim(),
    descripcionLarga: texto(body.descripcionLarga).trim(),
    imagen: archivo ? archivo.filename : texto(body.imagen),
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
  if (datos.categoriaNueva) {
    if (!datos.nombreCategoriaNueva) errores.nombreCategoriaNueva = 'Escribe el nombre del nuevo sabor y aroma.';
    else if (datos.nombreCategoriaNueva.length > 100) errores.nombreCategoriaNueva = 'El nombre puede tener hasta 100 caracteres.';
  } else if (!existe(opciones.categorias, datos.idCategoria)) errores.idCategoria = 'Elige el sabor y aroma del producto.';

  if (!datos.precioTexto) errores.precio = 'Ingresa el precio.';
  else if (Number.isNaN(datos.precio)) errores.precio = 'El precio debe ser un número entero en pesos, sin decimales (ej.: 1490).';
  else if (datos.precio < 0) errores.precio = 'El precio no puede ser negativo.';
  else if (datos.precio === 0) errores.precio = 'El precio debe ser mayor que 0.';
  else if (datos.precio > PRECIO_MAX) errores.precio = 'El precio es demasiado alto.';

  if (!datos.etiqueta) errores.etiqueta = 'Ingresa una descripción corta (se muestra en la tarjeta del catálogo).';
  else if (datos.etiqueta.length > LARGO.etiqueta) errores.etiqueta = `La descripción corta puede tener hasta ${LARGO.etiqueta} caracteres.`;
  if (datos.descripcionLarga.length > LARGO.descripcionLarga) errores.descripcionLarga = `La descripción puede tener hasta ${LARGO.descripcionLarga} caracteres.`;

  if (errorImagen) errores.imagen = errorImagen;
  else if (!archivo && !imagenes.includes(datos.imagen)) errores.imagen = 'Sube una imagen o elige una existente.';

  if (Number.isNaN(datos.stockInicial)) errores.stockInicial = 'El stock debe ser un número entero.';
  else if (datos.stockInicial < 0) errores.stockInicial = 'El stock no puede ser negativo.';
  else if (datos.stockInicial > STOCK_MAX) errores.stockInicial = `El stock inicial puede ser hasta ${STOCK_MAX} unidades.`;
  else if (datos.stockInicial > 0 && !existe(opciones.sucursales, datos.idSucursal)) errores.idSucursal = 'Elige la sucursal donde queda el stock.';

  return { datos, errores };
}

async function guardarImagen(req) {
  if (!req.file) return null;
  await fs.writeFile(path.join(CARPETA_IMAGENES, req.file.filename), req.file.buffer, { flag: 'wx' });
  return req.file.filename;
}

async function limpiarImagen(archivo) {
  if (!archivo) return;
  await fs.unlink(path.join(CARPETA_IMAGENES, archivo)).catch(error => {
    if (error.code !== 'ENOENT') console.warn('No se pudo limpiar una imagen de producto sin guardar.');
  });
}

function pedirImagenDeNuevo(req, datos, errores) {
  if (req.file) {
    datos.imagen = texto(req.body.imagen);
    errores.imagen = errores.imagen || 'Después de corregir los campos, vuelve a seleccionar la imagen.';
  }
}



async function mostrarVistaFormulario(res, estado, datos, errores, producto = null) {
  const [opciones, imagenes] = await Promise.all([Producto.opcionesFormulario(), imagenesDisponibles()]);
  res.status(estado).render('admin/producto-nuevo', { opciones, imagenes, datos, errores, producto });
}



function avisoDeLista(query, productos) {
  const buscar = (id) => productos.find((p) => p.id === Number(id));
  if (query.creado && buscar(query.creado)) return { tipo: 'exito', producto: buscar(query.creado), texto: 'Se creó' };
  if (query.editado && buscar(query.editado)) return { tipo: 'exito', producto: buscar(query.editado), texto: 'Se guardaron los cambios de' };
  if (query.activado && buscar(query.activado)) return { tipo: 'exito', producto: buscar(query.activado), texto: 'Se activó' };
  if (query.desactivado && buscar(query.desactivado)) return { tipo: 'exito', producto: buscar(query.desactivado), texto: 'Se desactivó' };
  if (query.eliminado) return { tipo: 'exito', texto: `Se eliminó el producto SKU ${texto(query.eliminado)}.` };

  if (query.conPedidos && buscar(query.conPedidos)) return { tipo: 'error', producto: buscar(query.conPedidos), texto: 'No se puede eliminar' };
  return null;
}


exports.listar = async (req, res, next) => {
  try {
    const productos = await Producto.listarParaAdmin();
    const aviso = avisoDeLista(req.query, productos);

    const creado = productos.find((p) => p.id === Number(req.query.creado || req.query.editado)) || null;
    res.render('admin/productos', { productos, creado, aviso });
  } catch (err) {
    next(err);
  }
};


exports.mostrarFormulario = async (req, res, next) => {
  try {
    await mostrarVistaFormulario(res, 200, { activo: true, esPersonalizable: true }, {});
  } catch (err) {
    next(err);
  }
};


exports.crear = async (req, res, next) => {
  let imagenGuardada = null;
  try {
    const [opciones, imagenes] = await Promise.all([Producto.opcionesFormulario(), imagenesDisponibles()]);
    const { datos, errores } = validarProducto(req.body, opciones, imagenes, req.file, req.errorImagen);


    if (!errores.sku && (await Producto.skuExiste(datos.sku))) errores.sku = 'Ya existe un producto con este SKU.';
    if (Object.keys(errores).length > 0) {
      pedirImagenDeNuevo(req, datos, errores);
      return res.status(400).render('admin/producto-nuevo', { opciones, imagenes, datos, errores, producto: null });
    }

    imagenGuardada = await guardarImagen(req);
    const id = await Producto.crear(datos, req.session.usuario.id);
    imagenGuardada = null;

    res.redirect('/admin/productos?creado=' + id);
  } catch (err) {
    await limpiarImagen(imagenGuardada);

    if (err.code === 'ER_DUP_ENTRY') {
      try {
        const { datos } = validarProducto(req.body, await Producto.opcionesFormulario(), await imagenesDisponibles());
        const errores = { sku: 'Ya existe un producto con este SKU.' };
        pedirImagenDeNuevo(req, datos, errores);
        return await mostrarVistaFormulario(res, 400, datos, errores);
      } catch (e) {
        return next(e);
      }
    }
    next(err);
  }
};






exports.mostrarEdicion = async (req, res, next) => {
  try {
    const producto = await Producto.obtenerParaEditar(Number(req.params.id));
    if (!producto) return res.status(404).render('errores/no-encontrado', { mensaje: 'Ese producto no existe.' });
    await mostrarVistaFormulario(res, 200, producto, {}, producto);
  } catch (err) {
    next(err);
  }
};



exports.guardarEdicion = async (req, res, next) => {
  let imagenGuardada = null;
  try {
    const producto = await Producto.obtenerParaEditar(Number(req.params.id));
    if (!producto) return res.status(404).render('errores/no-encontrado', { mensaje: 'Ese producto no existe.' });

    const [opciones, imagenes] = await Promise.all([Producto.opcionesFormulario(), imagenesDisponibles()]);
    const { datos, errores } = validarProducto({ ...req.body, sku: producto.sku, stockInicial: '' }, opciones, imagenes, req.file, req.errorImagen);
    if (Object.keys(errores).length > 0) {
      pedirImagenDeNuevo(req, datos, errores);
      return res.status(400).render('admin/producto-nuevo', { opciones, imagenes, datos, errores, producto });
    }

    imagenGuardada = await guardarImagen(req);
    await Producto.actualizar(producto.id, datos);
    imagenGuardada = null;
    res.redirect('/admin/productos?editado=' + producto.id);
  } catch (err) {
    await limpiarImagen(imagenGuardada);
    next(err);
  }
};


exports.cambiarActivo = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const activo = req.body.activo === '1';
    const existe = await Producto.cambiarActivo(id, activo);
    if (!existe) return res.status(404).render('errores/no-encontrado', { mensaje: 'Ese producto no existe.' });
    res.redirect(`/admin/productos?${activo ? 'activado' : 'desactivado'}=${id}`);
  } catch (err) {
    next(err);
  }
};



exports.eliminar = async (req, res, next) => {
  try {
    const producto = await Producto.obtenerParaEditar(Number(req.params.id));
    if (!producto) return res.status(404).render('errores/no-encontrado', { mensaje: 'Ese producto no existe.' });
    if (await Producto.tienePedidos(producto.id)) return res.redirect('/admin/productos?conPedidos=' + producto.id);

    await Producto.eliminar(producto.id);
    res.redirect('/admin/productos?eliminado=' + encodeURIComponent(producto.sku));
  } catch (err) {
    if (err.code === 'PRODUCTO_CON_PEDIDOS') return res.redirect('/admin/productos?conPedidos=' + Number(req.params.id));
    next(err);
  }
};

exports.validarProducto = validarProducto;
