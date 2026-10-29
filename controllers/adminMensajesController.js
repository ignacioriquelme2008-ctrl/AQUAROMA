// Controlador de lectura de mensajes de contacto en administración (HU-012 y HU-035).
const Mensaje = require('../models/Mensaje');

exports.listar = async (req, res, next) => {
  try {
    const mensajes = await Mensaje.listar();
    res.render('admin/mensajes', { mensajes });
  } catch (err) {
    next(err);
  }
};

exports.marcarLeido = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isInteger(id) && id > 0) await Mensaje.marcarLeido(id);
    res.redirect('/admin/mensajes');
  } catch (err) {
    next(err);
  }
};
