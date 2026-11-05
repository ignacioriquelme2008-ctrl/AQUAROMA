const Pedido = require('../models/Pedido');
const Inventario = require('../models/Inventario');
const Mensaje = require('../models/Mensaje');

const LIMITE = 5;

exports.panel = async (req, res, next) => {
  try {
    const permisos = req.session.usuario.permisos || [];
    const verPedidos = permisos.includes('gestionar_pedidos');
    const verStock = permisos.includes('gestionar_stock');
    const verMensajes = permisos.includes('ver_mensajes');
    const [pagados, preparando, pedidos, productos, sucursales, movimientos, mensajes] = await Promise.all([
      verPedidos ? Pedido.listarAdmin('pagado', LIMITE + 1) : [],
      verPedidos ? Pedido.listarAdmin('preparando', LIMITE + 1) : [],
      verPedidos ? Pedido.listarAdmin(null, LIMITE) : [],
      verStock ? Inventario.listar() : [],
      verStock ? Inventario.sucursales() : [],
      verStock ? Inventario.movimientosRecientes(LIMITE) : [],
      verMensajes ? Mensaje.sinLeer(LIMITE) : { total: 0, ultimos: [] },
    ]);

    const avisosPedido = (filas, estado, accion, tono) => ({
      url: '/admin/pedidos?estado=' + estado,
      mas: filas.length > LIMITE,
      filas: filas.slice(0, LIMITE).map(p => ({
        titulo: 'Pedido #' + p.id,
        detalle: p.sucursal || 'Sucursal por asignar',
        fecha: p.fecha,
        estado: Pedido.NOMBRES[estado],
        tono,
        accion,
        url: '/admin/pedidos/' + p.id,
      })),
    });

    const stock = productos.filter(p => p.activo && p.bajo).flatMap(p => {
      const cantidades = sucursales.filter(s => p.sucursales[s.id])
        .map(s => s.nombre + ': ' + p.sucursales[s.id].cantidad + ' u.').join(' · ');
      return sucursales.filter(s => p.sucursales[s.id]?.bajo).map(s => {
        const agotado = p.sucursales[s.id].cantidad === 0;
        return {
          titulo: p.nombre + ' · ' + s.nombre,
          detalle: cantidades,
          estado: agotado ? 'Agotado' : 'Stock bajo',
          tono: agotado ? 'peligro' : 'alerta',
          accion: 'Actualizar stock',
          url: '/admin/stock?sucursal=' + s.id + '&producto=' + p.id + '#stock-herramientas',
        };
      });
    });
    stock.sort((a, b) => Number(b.tono === 'peligro') - Number(a.tono === 'peligro'));

    const grupos = [
      { titulo: 'Por preparar', ...avisosPedido(pagados, 'pagado', 'Preparar pedido', 'exito') },
      { titulo: 'En preparación', ...avisosPedido(preparando, 'preparando', 'Revisar despacho', 'info') },
      { titulo: 'Stock por sucursal', url: '/admin/stock?bajo=1', mas: stock.length > LIMITE, filas: stock.slice(0, LIMITE) },
      {
        titulo: 'Mensajes sin leer',
        url: '/admin/mensajes',
        mas: mensajes.total > mensajes.ultimos.length,
        filas: mensajes.ultimos.map(m => ({
          titulo: m.asunto,
          detalle: m.nombre,
          fecha: m.creado_en,
          estado: 'Sin leer',
          tono: 'info',
          accion: 'Abrir mensaje',
          url: '/admin/mensajes#mensaje-' + m.id,
        })),
      },
    ].filter(grupo => grupo.filas.length);

    const recientes = [
      ...pedidos.map(p => ({
        titulo: 'Pedido #' + p.id + ' · ' + Pedido.NOMBRES[p.estado],
        url: '/admin/pedidos/' + p.id,
        fecha: p.fecha,
      })),
      ...movimientos.map(m => ({
        titulo: 'Movimiento de stock · ' + m.producto + ' · ' + m.sucursal,
        url: '/admin/stock',
        fecha: m.fecha,
      })),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, LIMITE);

    res.render('admin/panel', { grupos, recientes });
  } catch (err) {
    next(err);
  }
};
