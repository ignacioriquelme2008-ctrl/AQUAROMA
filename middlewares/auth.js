// Middlewares de acceso (HU-006 y HU-004).
// Un middleware es una función que Express ejecuta ANTES del controlador de una ruta.
// Recibe (req, res, next): si todo está bien llama a next() para seguir; si no, responde él mismo.
// Se usan así en una ruta:  router.get('/admin', requiereSesion, soloAdmin, controlador)

// Solo deja pasar a quien inició sesión. Si no hay sesión, lo manda al login y recuerda
// a qué página quería entrar, para devolverlo ahí después de iniciar sesión (HU-004, criterio 2).
function requiereSesion(req, res, next) {
  if (req.session.usuario) return next();
  return res.redirect('/login?volver=' + encodeURIComponent(req.originalUrl));
}

// Solo deja pasar al rol Administrador. Un cliente que escribe la URL a mano ve "Acceso denegado" (HU-006, criterio 3).
// Va siempre DESPUÉS de requiereSesion, porque necesita saber quién es el usuario.
function soloAdmin(req, res, next) {
  if (req.session.usuario && req.session.usuario.esAdmin) return next();
  return res.status(403).render('errores/acceso-denegado');
}

// Revisa un permiso concreto de la tabla "permiso" (HU-006, criterio 4).
// Ejemplo para HU-036:  router.post('/admin/productos', requiereSesion, requierePermiso('gestionar_productos'), ...)
function requierePermiso(nombrePermiso) {
  return (req, res, next) => {
    const permisos = (req.session.usuario && req.session.usuario.permisos) || [];
    if (permisos.includes(nombrePermiso)) return next();
    return res.status(403).render('errores/acceso-denegado');
  };
}

// HU-026: para las rutas /carrito/api, que usa public/js/carrito.js por detrás (no una persona).
// Solo deja pasar a un CLIENTE con sesión (el administrador no tiene carrito, porque no compra).
// En vez de redirigir al login responde un error 401 en JSON, que es lo que entiende el fetch.
function soloClienteApi(req, res, next) {
  if (req.session.usuario && req.session.usuario.idCliente) return next();
  return res.status(401).json({ error: 'Inicia sesión como cliente para guardar tu carrito.' });
}

module.exports = { requiereSesion, soloAdmin, requierePermiso, soloClienteApi };
