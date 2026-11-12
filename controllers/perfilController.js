



const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Direccion = require('../models/Direccion');
const Producto = require('../models/Producto');
const Carrito = require('../models/Carrito');
const Favorito = require('../models/Favorito');
const Pedido = require('../models/Pedido');
const { PASS_REGEX, TEL_REGEX, LARGO_MAX, texto, leerDireccionNueva } = require('../utils/validaciones');
const { MAX_CANTIDAD } = require('../utils/carrito');


const EXITOS = {
  datos: 'Guardamos tus datos personales.',
  password: 'Cambiamos tu contraseña.',
  direccion: 'Agregamos la nueva dirección de entrega.',
  direccionEditada: 'Actualizamos la dirección de entrega.',
  direccionEliminada: 'Quitamos la dirección de entrega.',
  principal: 'Esa dirección quedó como principal.',
  favoritaEliminada: 'Quitamos esa configuración de tus favoritas.',
};


const LARGO_ALIAS = 50;



const idClienteDe = (req) => req.session.usuario.idCliente;



async function renderPerfil(req, res, estado, extra = {}) {
  const idCliente = idClienteDe(req);
  const puedeVerPedidos = (req.session.usuario.permisos || []).includes('ver_mis_pedidos');
  const seccion = req.method === 'GET' && req.query.seccion === 'pedidos' && puedeVerPedidos ? 'pedidos' : 'configuracion';
  const pedidos = seccion === 'pedidos' ? await Pedido.listarDeCliente(idCliente) : [];
  const [perfil, direcciones, favoritos] = await Promise.all([
    Usuario.obtenerPerfil(req.session.usuario.id),
    Direccion.listarDeCliente(idCliente),
    Favorito.listarDeCliente(idCliente),
  ]);
  if (!perfil) return res.status(404).render('errores/no-encontrado');

  return res.status(estado).render('perfil/perfil', {
    perfil,
    seccion,
    puedeVerPedidos,
    pedidos,
    nombres: Pedido.NOMBRES,
    direcciones,
    favoritos,
    exito: null,
    errores: {},
    datos: { nombre: perfil.nombre, apellido: perfil.apellido, telefono: perfil.telefono },
    passwordErrores: {},
    direccionErrores: {},
    direccionDatos: {},
    ...extra,
  });
}


exports.ver = async (req, res, next) => {
  try {
    await renderPerfil(req, res, 200, { exito: EXITOS[texto(req.query.ok)] || null });
  } catch (err) {
    next(err);
  }
};



exports.guardarDatos = async (req, res, next) => {
  const datos = {
    nombre: texto(req.body.nombre).trim(),
    apellido: texto(req.body.apellido).trim(),

    telefono: texto(req.body.telefono).replace(/\s+/g, ''),
  };
  const errores = {};

  if (!datos.nombre) errores.nombre = 'Ingresa tu nombre.';
  else if (datos.nombre.length > LARGO_MAX.nombre) errores.nombre = `El nombre puede tener hasta ${LARGO_MAX.nombre} caracteres.`;
  if (!datos.apellido) errores.apellido = 'Ingresa tu apellido.';
  else if (datos.apellido.length > LARGO_MAX.apellido) errores.apellido = `El apellido puede tener hasta ${LARGO_MAX.apellido} caracteres.`;
  if (!datos.telefono) errores.telefono = 'Ingresa tu teléfono.';
  else if (!TEL_REGEX.test(datos.telefono)) errores.telefono = 'Ingresa un teléfono válido (8 a 15 dígitos).';

  try {
    if (Object.keys(errores).length > 0) {
      return await renderPerfil(req, res, 400, { errores, datos });
    }

    await Usuario.actualizarDatos(idClienteDe(req), datos);


    req.session.usuario.nombre = datos.nombre;
    res.redirect('/perfil?ok=datos');
  } catch (err) {
    next(err);
  }
};



exports.cambiarPassword = async (req, res, next) => {
  const actual = texto(req.body.actual);
  const nueva = texto(req.body.nueva);
  const confirmar = texto(req.body.confirmar);
  const errores = {};

  if (!actual) errores.actual = 'Escribe tu contraseña actual.';
  if (!nueva) errores.nueva = 'Ingresa una contraseña nueva.';
  else if (!PASS_REGEX.test(nueva)) errores.nueva = 'Entre 8 y 20 caracteres, con mayúscula, minúscula, número y carácter especial.';
  else if (nueva === actual) errores.nueva = 'La contraseña nueva debe ser distinta de la actual.';
  if (!confirmar) errores.confirmar = 'Repite la contraseña nueva.';
  else if (nueva !== confirmar) errores.confirmar = 'Las contraseñas no coinciden.';

  try {
    if (!errores.actual) {
      const hash = await Usuario.obtenerPasswordHash(req.session.usuario.id);
      const coincide = hash ? await bcrypt.compare(actual, hash) : false;
      if (!coincide) errores.actual = 'Tu contraseña actual no es correcta.';
    }

    if (Object.keys(errores).length > 0) {
      return await renderPerfil(req, res, 400, { passwordErrores: errores });
    }

    await Usuario.cambiarPassword(req.session.usuario.id, nueva);
    res.redirect('/perfil?ok=password');
  } catch (err) {
    next(err);
  }
};


function leerAlias(fuente) {
  const alias = texto(fuente.alias).trim();
  if (alias.length > LARGO_ALIAS) return { error: `El nombre de la dirección puede tener hasta ${LARGO_ALIAS} caracteres.` };
  return { alias: alias || null };
}



exports.crearDireccion = async (req, res, next) => {
  const revisada = leerDireccionNueva(req.body);
  const revisadoAlias = leerAlias(req.body);
  const errores = {};

  if (revisada.error) errores.general = revisada.error;
  if (revisadoAlias.error) errores.alias = revisadoAlias.error;

  try {
    if (Object.keys(errores).length > 0) {
      return await renderPerfil(req, res, 400, {
        direccionErrores: errores,
        direccionDatos: { ...req.body },
      });
    }

    await Direccion.crear(idClienteDe(req), { ...revisada.datos, alias: revisadoAlias.alias });
    res.redirect('/perfil?ok=direccion');
  } catch (err) {
    next(err);
  }
};



exports.editarDireccion = async (req, res, next) => {
  const idDireccion = Number(req.params.id);
  const revisada = leerDireccionNueva(req.body);
  const revisadoAlias = leerAlias(req.body);
  const errores = {};

  if (revisada.error) errores.general = revisada.error;
  if (revisadoAlias.error) errores.alias = revisadoAlias.error;

  try {
    if (Object.keys(errores).length > 0) {
      return await renderPerfil(req, res, 400, {
        direccionErrores: errores,
        direccionDatos: { ...req.body },
        direccionEditando: idDireccion,
      });
    }

    const guardada = await Direccion.actualizar(idClienteDe(req), idDireccion, {
      ...revisada.datos, alias: revisadoAlias.alias,
    });
    if (!guardada) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Esa dirección no está en tu cuenta.' });
    }

    res.redirect('/perfil?ok=direccionEditada');
  } catch (err) {
    next(err);
  }
};


exports.marcarPrincipal = async (req, res, next) => {
  try {
    const ok = await Direccion.marcarPrincipal(idClienteDe(req), Number(req.params.id));
    if (!ok) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Esa dirección no está en tu cuenta.' });
    }
    res.redirect('/perfil?ok=principal');
  } catch (err) {
    next(err);
  }
};



exports.eliminarDireccion = async (req, res, next) => {
  try {
    const eliminada = await Direccion.eliminar(idClienteDe(req), Number(req.params.id));
    if (!eliminada) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Esa dirección no está en tu cuenta.' });
    }
    res.redirect('/perfil?ok=direccionEliminada');
  } catch (err) {
    next(err);
  }
};








const LARGO_FAVORITA = 60;



function volverAlCarrito(req, res, mensaje) {
  req.session.avisoCarrito = mensaje;
  return res.redirect('/carrito');
}


exports.crearFavorito = async (req, res, next) => {
  const alias = texto(req.body.alias).trim().replace(/\s+/g, ' ');

  if (!alias) return volverAlCarrito(req, res, 'Ponle un nombre a tu configuración favorita.');
  if (alias.length > LARGO_FAVORITA) {
    return volverAlCarrito(req, res, `El nombre puede tener hasta ${LARGO_FAVORITA} caracteres.`);
  }

  try {
    const id = Number(req.body.id);
    const producto = Number.isInteger(id) && id > 0 ? await Producto.obtenerPorId(id) : null;
    if (!producto) return volverAlCarrito(req, res, 'Ese producto ya no está disponible.');


    const idComponente = Number(texto(req.body.idComponente).trim());
    const aroma = Number.isInteger(idComponente) && idComponente > 0
      ? await Producto.obtenerAromaParaProducto(id, idComponente)
      : null;
    if (!aroma) return volverAlCarrito(req, res, 'El sabor y aroma elegidos no están disponibles para este producto.');

    const intensidad = Number(texto(req.body.intensidad).trim());
    if (!Number.isInteger(intensidad) || intensidad < 1 || intensidad > 5) {
      return volverAlCarrito(req, res, 'Elige una intensidad del aroma entre 1 y 5 dosis.');
    }


    const configuracion = await Carrito.guardarConfiguracionPersonalizada(idClienteDe(req), {
      idProducto: id,
      idComponente,
      intensidad,
      precioBase: producto.precio,
      nombreProducto: producto.nombre,
    });
    const idConfiguracion = configuracion && configuracion.id;
    if (!idConfiguracion) return volverAlCarrito(req, res, 'No pudimos guardar esa combinación. Inténtalo de nuevo.');

    await Favorito.crear(idClienteDe(req), idConfiguracion, alias);
    return volverAlCarrito(req, res, `Guardaste "${alias}" como favorita. La encuentras en tu perfil.`);
  } catch (err) {

    if (err.code === 'ER_DUP_ENTRY') {
      return volverAlCarrito(req, res, 'Ya tienes una favorita con ese nombre. Elige otro.');
    }
    next(err);
  }
};


exports.eliminarFavorito = async (req, res, next) => {
  try {
    const quitada = await Favorito.eliminar(idClienteDe(req), Number(req.params.id));
    if (!quitada) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Esa favorita no está en tu cuenta.' });
    }
    res.redirect('/perfil?ok=favoritaEliminada');
  } catch (err) {
    next(err);
  }
};



exports.favoritoAlCarrito = async (req, res, next) => {
  try {
    const idCliente = idClienteDe(req);
    const favorita = await Favorito.obtenerDeCliente(idCliente, Number(req.params.id));
    if (!favorita) {
      return res.status(404).render('errores/no-encontrado', { mensaje: 'Esa favorita no está en tu cuenta.' });
    }
    if (!favorita.disponible) {
      return volverAlCarrito(req, res, `"${favorita.alias}" no está disponible por ahora.`);
    }

    const lineas = await Carrito.obtenerLineas(idCliente);
    const actual = lineas.find((l) => l.id === favorita.idProducto
      && (l.idComponente || null) === favorita.idComponente
      && (l.intensidad || null) === favorita.intensidad);
    const antes = actual ? actual.qty : 0;
    const tope = Math.min(favorita.stock, MAX_CANTIDAD);
    const unidadesProducto = lineas
      .filter((l) => l.id === favorita.idProducto)
      .reduce((total, l) => total + l.qty, 0);

    if (unidadesProducto >= tope) {
      return volverAlCarrito(req, res, `Ya tienes el máximo disponible de "${favorita.producto}" (${tope}).`);
    }

    const despues = antes + 1;
    if (actual) actual.qty = despues;
    else {
      lineas.push({
        id: favorita.idProducto,
        qty: despues,
        ...(favorita.idComponente ? { idComponente: favorita.idComponente, intensidad: favorita.intensidad } : {}),
      });
    }
    await Carrito.guardar(idCliente, lineas);

    return volverAlCarrito(req, res, `Agregaste "${favorita.alias}" al carrito.`);
  } catch (err) {
    next(err);
  }
};
