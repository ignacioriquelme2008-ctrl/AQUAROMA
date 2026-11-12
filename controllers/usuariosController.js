

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Carrito = require('../models/Carrito');
const correoServicio = require('../config/correo');
const { EMAIL_REGEX, PASS_REGEX, TEL_REGEX, LARGO_MAX, texto } = require('../utils/validaciones');
const { normalizarItems } = require('../utils/carrito');



const HASH_FALSO = bcrypt.hashSync('cuenta-inexistente', 10);



const rutaSegura = (ruta) => (typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : '');


exports.mostrarRegistro = (req, res) => {
  res.render('usuarios/registro', { errores: {}, datos: {} });
};


exports.registrar = async (req, res) => {
  const datos = {
    nombre: texto(req.body.nombre).trim(),
    apellido: texto(req.body.apellido).trim(),

    telefono: texto(req.body.telefono).replace(/\s+/g, ''),
    correo: texto(req.body.correo).trim().toLowerCase(),
  };
  const password = texto(req.body.password);
  const confirmar = texto(req.body.confirmar);
  const errores = {};

  if (!datos.nombre) errores.nombre = 'Ingresa tu nombre.';
  else if (datos.nombre.length > LARGO_MAX.nombre) errores.nombre = `El nombre puede tener hasta ${LARGO_MAX.nombre} caracteres.`;
  if (!datos.apellido) errores.apellido = 'Ingresa tu apellido.';
  else if (datos.apellido.length > LARGO_MAX.apellido) errores.apellido = `El apellido puede tener hasta ${LARGO_MAX.apellido} caracteres.`;
  if (!datos.telefono) errores.telefono = 'Ingresa tu teléfono.';
  else if (!TEL_REGEX.test(datos.telefono)) errores.telefono = 'Ingresa un teléfono válido (8 a 15 dígitos).';
  if (!datos.correo) errores.correo = 'Ingresa tu correo.';
  else if (datos.correo.length > LARGO_MAX.correo) errores.correo = `El correo puede tener hasta ${LARGO_MAX.correo} caracteres.`;
  else if (!EMAIL_REGEX.test(datos.correo)) errores.correo = 'El correo no tiene un formato válido.';
  if (!password) errores.password = 'Ingresa una contraseña.';
  else if (!PASS_REGEX.test(password)) errores.password = 'Entre 8 y 20 caracteres, con mayúscula, minúscula, número y carácter especial.';
  else if (password !== confirmar) errores.confirmar = 'Las contraseñas no coinciden.';

  try {
    if (!errores.correo && (await Usuario.correoExiste(datos.correo))) {
      errores.correo = 'Este correo ya está registrado.';
    }
    if (Object.keys(errores).length > 0) {
      return res.status(400).render('usuarios/registro', { errores, datos });
    }

    await Usuario.crear({ ...datos, password });
    res.redirect('/login?registrado=1');
  } catch (err) {

    if (err.code === 'ER_DUP_ENTRY') {
      errores.correo = 'Este correo ya está registrado.';
      return res.status(400).render('usuarios/registro', { errores, datos });
    }
    console.error(err);
    res.status(500).render('usuarios/registro', {
      errores: { general: 'No pudimos crear la cuenta. Inténtalo de nuevo.' },
      datos,
    });
  }
};

exports.mostrarLogin = (req, res) => {
  const exito = req.query.registrado ? 'Cuenta creada exitosamente. Ya puedes iniciar sesión.' : null;
  const passwordRestablecida = req.query.passwordRestablecida === '1';

  const volver = rutaSegura(req.query.volver);

  const aviso = !volver ? null
    : volver === '/carrito' ? 'Inicia sesión para confirmar tu pedido. Los productos de tu carrito se mantienen.'
    : 'Inicia sesión para entrar a esa página.';
  res.render('usuarios/login', { error: null, exito, passwordRestablecida, aviso, correo: '', volver });
};


const MENSAJE_RECUPERACION = 'Si el correo existe en la plataforma, recibirás las instrucciones para recuperar tu acceso.';

exports.mostrarRecuperacion = (req, res) => {
  res.render('usuarios/recuperar', { mensaje: null, error: null, correo: '' });
};

exports.solicitarRecuperacion = async (req, res) => {
  const correo = texto(req.body.correo).trim().toLowerCase();
  if (!correo || correo.length > LARGO_MAX.correo || !EMAIL_REGEX.test(correo)) {
    return res.status(400).render('usuarios/recuperar', {
      mensaje: null,
      error: 'Ingresa un correo electrónico válido.',
      correo,
    });
  }

  try {
    const usuario = await Usuario.buscarParaRecuperacion(correo);
    if (usuario && usuario.usuario_activo && (usuario.cliente_activo === null || usuario.cliente_activo)) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await Usuario.crearTokenRecuperacion(usuario.id_usuario, tokenHash);
      if (correoServicio.configurado()) {

        void correoServicio.enviarRecuperacion(usuario.correo, token).catch(() => {

          console.warn('HU-005: no se pudo enviar el correo de recuperación.');
        });
      } else {
        console.warn('HU-005: configure SMTP para habilitar el envío de recuperación.');
      }
    }
    return res.render('usuarios/recuperar', { mensaje: MENSAJE_RECUPERACION, error: null, correo: '' });
  } catch (err) {
    console.error('HU-005: no se pudo procesar la solicitud de recuperación.');

    return res.render('usuarios/recuperar', { mensaje: MENSAJE_RECUPERACION, error: null, correo: '' });
  }
};

exports.mostrarNuevaPassword = async (req, res, next) => {
  try {
    const token = texto(req.params.token);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const valido = await Usuario.validarTokenRecuperacion(tokenHash);
    if (!valido) {
      return res.status(400).render('usuarios/nueva-password', {
        token: '',
        errores: [],
        errorEnlace: 'El enlace expiró o ya fue utilizado. Solicita uno nuevo para continuar.',
      });
    }
    return res.render('usuarios/nueva-password', { token, errores: [], errorEnlace: null });
  } catch (err) {
    return next(err);
  }
};

exports.restablecerPassword = async (req, res, next) => {
  const token = texto(req.params.token);
  const nueva = texto(req.body.password);
  const confirmar = texto(req.body.confirmar);
  const errores = [];
  if (!PASS_REGEX.test(nueva)) errores.push('La contraseña debe tener 8 a 20 caracteres, mayúscula, minúscula, número y carácter especial, sin espacios.');
  if (nueva !== confirmar) errores.push('Las contraseñas no coinciden.');
  if (errores.length) return res.status(400).render('usuarios/nueva-password', { token, errores, errorEnlace: null });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const actualizada = await Usuario.restablecerPassword(tokenHash, nueva);
    if (!actualizada) {
      return res.status(400).render('usuarios/nueva-password', {
        token: '',
        errores: [],
        errorEnlace: 'El enlace expiró o ya fue utilizado. Solicita uno nuevo para continuar.',
      });
    }
    return res.redirect('/login?passwordRestablecida=1');
  } catch (err) {
    return next(err);
  }
};


exports.login = async (req, res) => {
  const correo = texto(req.body.correo).trim().toLowerCase();
  const password = texto(req.body.password);
  const volver = rutaSegura(texto(req.body.volver));

  const vistaConError = (error) => ({ error, exito: null, correo, volver });

  try {
    const usuario = correo ? await Usuario.buscarPorCorreo(correo) : null;

    const claveOk = (await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO)) && Boolean(usuario);


    if (!claveOk) {
      return res.status(401).render('usuarios/login', vistaConError('Correo o contraseña incorrectos.'));
    }


    if (!usuario.usuario_activo || (usuario.id_cliente && !usuario.cliente_activo)) {
      return res.status(403).render('usuarios/login', vistaConError('Tu cuenta está inactiva o deshabilitada. Comunícate con la tienda.'));
    }


    const roles = usuario.roles ? usuario.roles.split(',') : [];
    const permisos = await Usuario.obtenerPermisos(usuario.id_usuario);
    const esAdmin = roles.includes('Administrador');

    await Usuario.registrarAcceso(usuario.id_usuario);



    const carritoVisitante = normalizarItems(req.session.carrito);



    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.usuario = {
      id: usuario.id_usuario,
      idCliente: usuario.id_cliente,

      nombre: usuario.nombre || (esAdmin ? 'Administrador' : usuario.correo),
      roles,
      permisos,
      esAdmin,
    };


    if (usuario.id_cliente && carritoVisitante.length > 0) {
      try {
        await Carrito.fusionar(usuario.id_cliente, carritoVisitante);
        req.session.carrito = [];
      } catch (err) {


        console.error('No se pudo unir el carrito de visitante:', err);
        req.session.carrito = carritoVisitante;
      }
    }



    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });


    res.redirect(volver || (esAdmin ? '/admin' : '/'));
  } catch (err) {
    console.error(err);
    res.status(500).render('usuarios/login', vistaConError('Ocurrió un error. Inténtalo de nuevo.'));
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};
