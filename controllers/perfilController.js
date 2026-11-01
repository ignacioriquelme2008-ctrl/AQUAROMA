// Controlador de la sección PERFIL del cliente (HU-007).
// Muestra y permite cambiar los datos personales, la contraseña y las direcciones de entrega.
// Toda acción que guarda algo termina en un redirect con ?ok=... (patrón POST + redirect):
// así al recargar no se reenvía el formulario y se puede mostrar el mensaje verde (criterio 4).
const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Direccion = require('../models/Direccion');
const { PASS_REGEX, TEL_REGEX, LARGO_MAX, texto, leerDireccionNueva } = require('../utils/validaciones');

// Texto del mensaje verde según lo que se acaba de guardar.
const EXITOS = {
  datos: 'Guardamos tus datos personales.',
  password: 'Cambiamos tu contraseña.',
  direccion: 'Agregamos la nueva dirección de entrega.',
  direccionEditada: 'Actualizamos la dirección de entrega.',
  direccionEliminada: 'Quitamos la dirección de entrega.',
  principal: 'Esa dirección quedó como principal.',
};

// Largo de cliente_direccion.alias (el resto de los campos lo revisa leerDireccionNueva).
const LARGO_ALIAS = 50;

// El id del cliente sale SIEMPRE de la sesión y nunca de un campo del formulario:
// así nadie puede ver ni editar el perfil de otra persona cambiando un número en la petición.
const idClienteDe = (req) => req.session.usuario.idCliente;

// Junta lo que necesita la vista y la dibuja. Se usa en el GET y también cuando un formulario
// llega con errores: en ese caso con código 400 y los valores que la persona había escrito.
async function renderPerfil(req, res, estado, extra = {}) {
  const [perfil, direcciones] = await Promise.all([
    Usuario.obtenerPerfil(req.session.usuario.id),
    Direccion.listarDeCliente(idClienteDe(req)),
  ]);
  if (!perfil) return res.status(404).render('errores/no-encontrado');

  return res.status(estado).render('perfil/perfil', {
    perfil,
    direcciones,
    exito: null,
    errores: {},
    datos: { nombre: perfil.nombre, apellido: perfil.apellido, telefono: perfil.telefono },
    passwordErrores: {},
    direccionErrores: {},
    direccionDatos: {},
    ...extra,
  });
}

// GET /perfil -> criterio 1: nombre, apellido, correo, teléfono y direcciones.
exports.ver = async (req, res, next) => {
  try {
    await renderPerfil(req, res, 200, { exito: EXITOS[texto(req.query.ok)] || null });
  } catch (err) {
    next(err);
  }
};

// POST /perfil/datos -> criterio 2: guardar los datos personales.
// El correo no se lee del formulario a propósito (decisión D1): es la identidad de login.
exports.guardarDatos = async (req, res, next) => {
  const datos = {
    nombre: texto(req.body.nombre).trim(),
    apellido: texto(req.body.apellido).trim(),
    // Igual que en el registro: se quitan los espacios para guardar solo los dígitos.
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
    // El nombre también vive en la sesión (lo usa el saludo del menú). Se actualiza para
    // que el cambio se vea de inmediato, sin tener que volver a iniciar sesión.
    req.session.usuario.nombre = datos.nombre;
    res.redirect('/perfil?ok=datos');
  } catch (err) {
    next(err);
  }
};

// POST /perfil/password -> criterios 3 y 4.
// La contraseña actual se compara con bcrypt contra el hash guardado: si no coincide, no se cambia.
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

// Revisa el alias de una dirección (opcional, pero con tope de largo).
function leerAlias(fuente) {
  const alias = texto(fuente.alias).trim();
  if (alias.length > LARGO_ALIAS) return { error: `El nombre de la dirección puede tener hasta ${LARGO_ALIAS} caracteres.` };
  return { alias: alias || null };
}

// POST /perfil/direcciones -> criterio 2 (agregar una dirección).
// La primera dirección del cliente queda como principal; las demás se agregan sin marcar.
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

// POST /perfil/direcciones/:id -> criterio 2 (editar una dirección guardada).
// El modelo comprueba que la dirección sea de este cliente antes de tocarla (evita IDOR).
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

// POST /perfil/direcciones/:id/principal -> deja esa dirección como principal.
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

// POST /perfil/direcciones/:id/eliminar -> quita la dirección.
// Si era la principal y quedan otras, el modelo promueve la siguiente automáticamente.
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
