// Controlador del panel de administración (HU-006 y HU-035).
// Arriba muestra el resumen de la tienda (HU-035): ventas acumuladas, pedidos por estado, últimos
// 10 pedidos, mensajes sin leer y alertas de stock bajo (HU-039). Abajo, una tarjeta por sección.
// Cada sección la completa una historia del tablero:
//   Productos -> HU-036 y HU-037 | Stock -> HU-038 y HU-039 | Pedidos -> HU-040
//   Mensajes de contacto -> HU-035 (los mensajes llegan desde HU-012)
// Cuando una sección esté lista, se le agrega su "url" y la vista la muestra como enlace.
const Pedido = require('../models/Pedido');
const Inventario = require('../models/Inventario');
const Mensaje = require('../models/Mensaje');

exports.panel = async (req, res, next) => {
  try {
    // Cada sección indica qué permiso necesita (tabla "permiso"); la vista la marca si el usuario no lo tiene.
    const secciones = [
      { titulo: 'Productos', descripcion: 'Crear, editar y desactivar productos del catálogo.', permiso: 'gestionar_productos', url: '/admin/productos' },   // HU-036, HU-037
      { titulo: 'Stock por sucursal', descripcion: 'Ver y ajustar el inventario, con alertas de stock bajo.', permiso: 'gestionar_stock', url: '/admin/stock' },   // HU-038, HU-039
      { titulo: 'Pedidos', descripcion: 'Revisar los pedidos y actualizar su estado de envío.', permiso: 'gestionar_pedidos', url: '/admin/pedidos' },   // HU-040
      { titulo: 'Mensajes de contacto', descripcion: 'Leer los mensajes enviados desde el formulario de contacto.', permiso: 'ver_mensajes' },
    ];
    const permisos = req.session.usuario.permisos || [];

    // Resumen (HU-035). Todo se consulta en paralelo para que el panel cargue rápido.
    const [ventas, porEstado, ultimos, stockBajo, mensajes] = await Promise.all([
      Pedido.resumenVentas(),
      Pedido.contarPorEstado(),
      Pedido.listarAdmin(null, 10),
      Inventario.contarStockBajo(),
      permisos.includes('ver_mensajes') ? Mensaje.sinLeer(5) : { total: 0, ultimos: [] },
    ]);

    res.render('admin/panel', {
      secciones: secciones.map((s) => ({ ...s, permitido: permisos.includes(s.permiso) })),
      ventas, porEstado, ultimos, stockBajo, mensajes,
      nombres: Pedido.NOMBRES,
      puedeVerPedidos: permisos.includes('gestionar_pedidos'),
      puedeVerStock: permisos.includes('gestionar_stock'),
    });
  } catch (err) {
    next(err);
  }
};
