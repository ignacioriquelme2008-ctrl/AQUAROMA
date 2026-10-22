// Controlador de la sección USUARIOS (registro, login y logout).
// Valida los datos EN EL SERVIDOR y decide qué vista mostrar.
const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const { EMAIL_REGEX, PASS_REGEX, TEL_REGEX, LARGO_MAX, texto } = require('../utils/validaciones');

// Hash de una clave cualquiera. Si el correo no existe se compara contra este hash, así el login
// tarda lo mismo exista o no la cuenta, y nadie puede adivinar qué correos están registrados midiendo el tiempo.
const HASH_FALSO = bcrypt.hashSync('cuenta-inexistente', 10);

// HU-006: después del login solo se permite volver a una ruta interna del sitio (que empiece con "/").
// Así nadie puede armar un enlace que, al iniciar sesión, mande al usuario a otra página externa.
const rutaSegura = (ruta) => (typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : '');


exports.mostrarRegistro = (req, res) => {
  res.render('usuarios/registro', { errores: {}, datos: {} });
};

// Normaliza y valida el formulario; si el correo está libre, pide al modelo crear la cuenta.
exports.registrar = async (req, res) => {
  const datos = {
    nombre: texto(req.body.nombre).trim(),
    apellido: texto(req.body.apellido).trim(),
    // Se quitan los espacios ("+56 9 1234 5678" -> "+56912345678") para contar solo dígitos y guardarlo siempre igual.
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
    // Si dos personas se registran a la vez con el mismo correo, la base lo detiene (UNIQUE)
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
  // "volver" guarda la página privada que la persona quiso abrir antes de iniciar sesión (HU-004 / HU-006).
  const volver = rutaSegura(req.query.volver);
  // Si viene de una página privada, se le explica por qué está en el login.
  const aviso = !volver ? null
    : volver === '/carrito' ? 'Inicia sesión para confirmar tu pedido. Los productos de tu carrito se mantienen.'
    : 'Inicia sesión para entrar a esa página.';
  res.render('usuarios/login', { error: null, exito, aviso, correo: '', volver });
};

// Busca la cuenta, compara la contraseña con bcrypt y guarda en la sesión al usuario con su rol y permisos (HU-006).
exports.login = async (req, res) => {
  const correo = texto(req.body.correo).trim().toLowerCase();
  const password = texto(req.body.password);
  const volver = rutaSegura(texto(req.body.volver));
  // Datos que la vista de login necesita cada vez que se muestra con un error.
  const vistaConError = (error) => ({ error, exito: null, correo, volver });

  try {
    const usuario = correo ? await Usuario.buscarPorCorreo(correo) : null;
    // Siempre se ejecuta bcrypt (con HASH_FALSO si no hay cuenta) para que la respuesta tarde lo mismo.
    const claveOk = (await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO)) && Boolean(usuario);

    // Mismo mensaje si falla el correo o la clave: no revela cuál estaba mal
    if (!claveOk) {
      return res.status(401).render('usuarios/login', vistaConError('Correo o contraseña incorrectos.'));
    }

    // Recién con la clave correcta se informa si la cuenta está inactiva
    if (!usuario.usuario_activo || (usuario.id_cliente && !usuario.cliente_activo)) {
      return res.status(403).render('usuarios/login', vistaConError('Tu cuenta está inactiva o deshabilitada. Comunícate con la tienda.'));
    }

    // HU-006: se revisa qué tipo de cuenta es (Administrador o Cliente) y qué permisos tiene.
    const roles = usuario.roles ? usuario.roles.split(',') : [];
    const permisos = await Usuario.obtenerPermisos(usuario.id_usuario);
    const esAdmin = roles.includes('Administrador');

    await Usuario.registrarAcceso(usuario.id_usuario);

    // Se crea una sesión nueva al entrar (regenerate). Así nadie puede reutilizar una sesión
    // que existía antes del login para hacerse pasar por este usuario.
    req.session.regenerate((err) => {
      if (err) {
        console.error(err);
        return res.status(500).render('usuarios/login', vistaConError('Ocurrió un error. Inténtalo de nuevo.'));
      }
      req.session.usuario = {
        id: usuario.id_usuario,
        idCliente: usuario.id_cliente,
        // El administrador no tiene fila en "cliente", por eso no tiene nombre: se muestra "Administrador".
        nombre: usuario.nombre || (esAdmin ? 'Administrador' : usuario.correo),
        roles,
        permisos,
        esAdmin,
      };
      // El administrador entra a su panel; el cliente vuelve a la página que pidió o al inicio.
      res.redirect(volver || (esAdmin ? '/admin' : '/'));
    });
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
