// Controlador del panel de administración (HU-006).
// Por ahora solo muestra la portada del panel. Cada sección la completa una historia del tablero:
//   Resumen de ventas -> HU-035 | Productos -> HU-036 y HU-037 | Stock -> HU-038 y HU-039
//   Pedidos -> HU-040 | Mensajes de contacto -> HU-035 (los mensajes llegan desde HU-012)
// Cuando una sección esté lista, se le agrega su "url" y la vista la muestra como enlace.

exports.panel = (req, res) => {
  // Cada sección indica qué permiso necesita (tabla "permiso"); la vista la marca si el usuario no lo tiene.
  const secciones = [
    { titulo: 'Resumen de ventas', descripcion: 'Ventas acumuladas, pedidos por estado y últimos pedidos.', permiso: 'ver_panel_admin' },
    { titulo: 'Productos', descripcion: 'Crear, editar y desactivar productos del catálogo.', permiso: 'gestionar_productos', url: '/admin/productos' },   // HU-036
    { titulo: 'Stock por sucursal', descripcion: 'Ver y ajustar el inventario, con alertas de stock bajo.', permiso: 'gestionar_stock' },
    { titulo: 'Pedidos', descripcion: 'Revisar los pedidos y actualizar su estado de envío.', permiso: 'gestionar_pedidos' },
    { titulo: 'Mensajes de contacto', descripcion: 'Leer los mensajes enviados desde el formulario de contacto.', permiso: 'ver_mensajes' },
  ];
  const permisos = req.session.usuario.permisos || [];
  res.render('admin/panel', {
    secciones: secciones.map((s) => ({ ...s, permitido: permisos.includes(s.permiso) })),
  });
};
