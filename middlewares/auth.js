






function requiereSesion(req, res, next) {
  if (req.session.usuario) return next();
  return res.redirect('/login?volver=' + encodeURIComponent(req.originalUrl));
}



function soloAdmin(req, res, next) {
  if (req.session.usuario && req.session.usuario.esAdmin) return next();
  return res.status(403).render('errores/acceso-denegado');
}





function requiereCliente(req, res, next) {
  if (req.session.usuario && req.session.usuario.idCliente) return next();
  return res.status(403).render('errores/acceso-denegado');
}



function requierePermiso(nombrePermiso) {
  return (req, res, next) => {
    const permisos = (req.session.usuario && req.session.usuario.permisos) || [];
    if (permisos.includes(nombrePermiso)) return next();
    return res.status(403).render('errores/acceso-denegado');
  };
}

module.exports = { requiereSesion, soloAdmin, requiereCliente, requierePermiso };
