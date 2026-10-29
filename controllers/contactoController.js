// Controlador del formulario público de contacto (HU-012).
const Mensaje = require('../models/Mensaje');
const { EMAIL_REGEX, texto } = require('../utils/validaciones');

const MAXIMO = { nombre: 100, correo: 120, asunto: 150, mensaje: 5000 };

exports.mostrar = (req, res) => {
  const exito = Boolean(req.session.contactoEnviado);
  delete req.session.contactoEnviado;
  res.render('contacto/contacto', { datos: {}, errores: {}, exito });
};

// Valida siempre en el servidor: required y type=email del HTML son solo ayudas visuales.
exports.enviar = async (req, res, next) => {
  const datos = {
    nombre: texto(req.body.nombre).trim(),
    correo: texto(req.body.correo).trim().toLowerCase(),
    asunto: texto(req.body.asunto).trim(),
    mensaje: texto(req.body.mensaje).trim(),
  };
  const errores = {};

  if (!datos.nombre) errores.nombre = 'Escribe tu nombre.';
  else if (datos.nombre.length > MAXIMO.nombre) errores.nombre = `El nombre no puede superar ${MAXIMO.nombre} caracteres.`;

  if (!datos.correo) errores.correo = 'Escribe tu correo electrónico.';
  else if (datos.correo.length > MAXIMO.correo) errores.correo = `El correo no puede superar ${MAXIMO.correo} caracteres.`;
  else if (!EMAIL_REGEX.test(datos.correo)) errores.correo = 'Ingresa un correo electrónico válido.';

  if (!datos.asunto) errores.asunto = 'Escribe el asunto del mensaje.';
  else if (datos.asunto.length > MAXIMO.asunto) errores.asunto = `El asunto no puede superar ${MAXIMO.asunto} caracteres.`;

  if (!datos.mensaje) errores.mensaje = 'Escribe tu mensaje.';
  else if (datos.mensaje.length > MAXIMO.mensaje) errores.mensaje = `El mensaje no puede superar ${MAXIMO.mensaje} caracteres.`;

  if (Object.keys(errores).length > 0) {
    return res.status(400).render('contacto/contacto', { datos, errores, exito: false });
  }

  try {
    await Mensaje.guardar(datos);
    req.session.contactoEnviado = true;
    return res.redirect('/contacto');
  } catch (err) {
    next(err);
  }
};
