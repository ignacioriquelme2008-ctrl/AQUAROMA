







const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');
const Direccion = require('../models/Direccion');
const MetodoPago = require('../models/MetodoPago');
const Pedido = require('../models/Pedido');
const ventas = require('../config/ventas');
const notificarPedido = require('../utils/notificarPedido');
const { texto, leerDireccionNueva } = require('../utils/validaciones');
const { MAX_CANTIDAD, normalizarItems } = require('../utils/carrito');
const tipoCambio = require('../config/tipoCambio');
const paypalSandbox = require('./paypalSandboxController');
const PaypalCheckout = require('../models/PaypalCheckout');
const db = require('../config/db');




const ESTILOS_AROMA = {
  'Limón': ['🍋', '#fef9c3'],
  'Menta': ['🍃', '#e0f3dc'],
  'Frutilla': ['🍓', '#fde4ec'],
  'Pepino': ['🥒', '#e3f4d9'],
  'Durazno': ['🍑', '#ffedd5'],
  'Arándano': ['🫐', '#ece8f9'],
  'Mango': ['🥭', '#ffedd5'],
  'Frutos rojos': ['🍒', '#fde4ec'],
  'Hibisco y rosa': ['🌺', '#fce7f3'],
  'Limón y menta': ['🌿', '#fef9c3'],
  'Pepino y limón': ['🥒', '#e3f4d9'],
};


const rutaSegura = (ruta) => (typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : '');

const idClienteDe = (req) => (req.session.usuario && req.session.usuario.idCliente) || null;


function calcularTotales(items) {
  const subtotal = items.reduce((suma, i) => suma + i.subtotal, 0);
  const unidades = items.reduce((suma, i) => suma + i.qty, 0);
  return {
    unidades,
    subtotal,
    neto: ventas.neto(subtotal),
    iva: ventas.iva(subtotal),
    total: subtotal,
  };
}


const adornar = (items) => items.map((i) => {
  const [icono, color] = ESTILOS_AROMA[i.aroma] || ['💧', '#e0f2fe'];
  return { ...i, icono, color };
});



async function fusionarPendiente(req, idCliente) {
  const pendientes = normalizarItems(req.session.carrito);
  if (pendientes.length === 0) return;
  await Carrito.fusionar(idCliente, pendientes);
  req.session.carrito = [];
}


async function leerCarrito(req) {
  const idCliente = idClienteDe(req);
  if (idCliente) {
    await fusionarPendiente(req, idCliente);
    return Carrito.obtenerLineas(idCliente);
  }
  return normalizarItems(req.session.carrito);
}


async function guardarCarrito(req, lineas) {
  const items = normalizarItems(lineas);
  const idCliente = idClienteDe(req);
  if (idCliente) {
    await Carrito.guardar(idCliente, items);
  } else {
    req.session.carrito = items;
  }
}



async function renderCarrito(req, res, { error = null, datos = {}, estado = 200 } = {}) {
  const idCliente = idClienteDe(req);
  const [lineas, direcciones, metodos] = await Promise.all([
    leerCarrito(req),
    idCliente ? Direccion.listarDeCliente(idCliente) : Promise.resolve([]),
    MetodoPago.listarActivos(),
  ]);
  const items = adornar(await Producto.detallarCarrito(lineas));
  let pagoPaypal = null;
  if (idCliente && /^\d+$/.test(String(req.query.pagar || ''))) {
    pagoPaypal = await PaypalCheckout.obtener(Number(req.query.pagar), idCliente);
    if (pagoPaypal) {


      const pedidoParaPagar = await Pedido.obtener(Number(req.query.pagar), { idCliente });
      if (pedidoParaPagar) pagoPaypal.items = pedidoParaPagar.items;
      else pagoPaypal = null;
    }
    if (!pagoPaypal) { error = 'No encontramos ese pago en tu cuenta.'; estado = 404; }
  }
  let cambio = null;
  if (items.length) {
    try {
      cambio = await tipoCambio.obtener();
    } catch (err) {
      console.warn('No se pudo obtener el tipo de cambio para PayPal:', err.message);
    }
  }


  const unidadesPorProducto = new Map();
  for (const item of items) {
    unidadesPorProducto.set(item.id, (unidadesPorProducto.get(item.id) || 0) + item.qty);
  }
  for (const item of items) {
    item.unidadesEnCarrito = unidadesPorProducto.get(item.id) || 0;
    item.stockInsuficiente = item.unidadesEnCarrito > item.stock;
  }

  res.status(estado).render('carrito/carrito', {
    items,
    totales: calcularTotales(items),
    direcciones,
    metodos,
    ventas,
    paypal: { ...paypalSandbox.configuracionPublica(), cambio,
      usd: cambio && items.length ? tipoCambio.convertir(calcularTotales(items).total, cambio.tasa) : null },
    pagoPaypal,
    error,
    datos,
  });
}




exports.ver = async (req, res, next) => {
  try {
    await renderCarrito(req, res);
  } catch (err) {
    next(err);
  }
};


exports.agregar = async (req, res, next) => {
  const volver = rutaSegura(req.body.volver) || '/catalogo';
  try {
    const id = Number(req.body.id);
    const producto = Number.isInteger(id) && id > 0 ? await Producto.obtenerPorId(id) : null;
    if (!producto) {
      req.session.avisoCarrito = 'Ese producto ya no está disponible.';
      return res.redirect(volver);
    }

    const rawComponente = texto(req.body.idComponente).trim();
    let idComponente = null;
    let intensidad = null;
    if (rawComponente) {
      idComponente = Number(rawComponente);
      const aroma = Number.isInteger(idComponente) && idComponente > 0
        ? await Producto.obtenerAromaParaProducto(id, idComponente)
        : null;
      if (!aroma) {
        req.session.avisoCarrito = 'El sabor y aroma elegidos no están disponibles para este producto.';
        return res.redirect(volver);
      }
      intensidad = Number(texto(req.body.intensidad).trim());
      if (!Number.isInteger(intensidad) || intensidad < 1 || intensidad > 5) {
        req.session.avisoCarrito = 'Elige una intensidad de sabor y aroma entre 1 y 5 dosis.';
        return res.redirect(volver);
      }
    }

    const lineas = await leerCarrito(req);
    const actual = lineas.find((l) => l.id === id && (l.idComponente || null) === idComponente && (l.intensidad || null) === intensidad);
    const antes = actual ? actual.qty : 0;
    const tope = Math.min(producto.stock, MAX_CANTIDAD);
    const unidadesProducto = lineas
      .filter((l) => l.id === id)
      .reduce((total, l) => total + l.qty, 0);

    if (tope < 1) {
      req.session.avisoCarrito = `"${producto.nombre}" está agotado.`;
      return res.redirect(volver);
    }

    if (unidadesProducto >= tope) {
      req.session.avisoCarrito = `Solo hay ${tope} ${tope === 1 ? 'unidad' : 'unidades'} de "${producto.nombre}" disponibles. Ya alcanzaste ese límite en tu carrito.`;
      return res.redirect(volver);
    }

    const despues = antes + 1;
    if (actual) actual.qty = despues;
    else lineas.push({ id, qty: despues, ...(idComponente ? { idComponente, intensidad } : {}) });
    await guardarCarrito(req, lineas);

    req.session.avisoCarrito = despues > antes
      ? `"${producto.nombre}" se agregó al carrito.`
      : `Ya tienes el máximo disponible de "${producto.nombre}" (${tope}).`;
    return res.redirect(volver);
  } catch (err) {
    next(err);
  }
};



exports.cantidad = async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    const idComponente = Number(req.body.idComponente) || null;
    const intensidad = Number(req.body.intensidad) || null;
    const accion = texto(req.body.accion).trim();
    if (!Number.isInteger(id) || id <= 0) return res.redirect('/carrito');

    const lineas = await leerCarrito(req);
    const indice = lineas.findIndex((l) => l.id === id && (l.idComponente || null) === idComponente && (l.intensidad || null) === intensidad);
    if (indice === -1) return res.redirect('/carrito');

    const actual = lineas[indice];
    let qty = actual.qty;

    if (accion === 'sumar') qty = actual.qty + 1;
    else if (accion === 'restar') qty = actual.qty - 1;
    else if (accion === 'fijar') {
      const escrita = Math.floor(Number(req.body.qty));
      if (Number.isFinite(escrita) && escrita >= 1) qty = escrita;
    } else {
      return res.redirect('/carrito');
    }


    if (qty < 1) {
      lineas.splice(indice, 1);
      await guardarCarrito(req, lineas);
      return res.redirect('/carrito');
    }

    const producto = await Producto.obtenerPorId(id);
    const stock = producto ? producto.stock : 0;
    const tope = Math.min(stock, MAX_CANTIDAD);
    const otrasUnidades = lineas.reduce((total, linea, indiceLinea) => (
      total + (indiceLinea !== indice && linea.id === id ? linea.qty : 0)
    ), 0);
    const disponibleParaLinea = Math.max(0, tope - otrasUnidades);



    if (qty > actual.qty && qty > disponibleParaLinea) {
      if (disponibleParaLinea >= actual.qty) qty = disponibleParaLinea;
      else qty = actual.qty;
      req.session.avisoCarrito = tope < 1
        ? `"${producto ? producto.nombre : 'Este producto'}" está agotado. Quítalo del carrito para continuar.`
        : `Solo hay ${tope} ${tope === 1 ? 'unidad' : 'unidades'} de "${producto.nombre}" disponibles en total. Ajusta las cantidades de sus preparaciones.`;
    }

    actual.qty = qty;
    await guardarCarrito(req, lineas);
    return res.redirect('/carrito');
  } catch (err) {
    next(err);
  }
};


exports.eliminar = async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    const idComponente = Number(req.body.idComponente) || null;
    const intensidad = Number(req.body.intensidad) || null;
    if (Number.isInteger(id) && id > 0) {
      const lineas = await leerCarrito(req);
      await guardarCarrito(req, lineas.filter((l) => !(l.id === id && (l.idComponente || null) === idComponente && (l.intensidad || null) === intensidad)));
    }
    return res.redirect('/carrito');
  } catch (err) {
    next(err);
  }
};






exports.confirmar = async (req, res, next) => {
  const idCliente = idClienteDe(req);


  if (!idCliente) return res.redirect('/login?volver=' + encodeURIComponent('/carrito'));


  const datos = {
    direccion: texto(req.body.direccion).trim(),
    pago: texto(req.body.pago).trim(),
    calle: texto(req.body.calle).trim(),
    numero: texto(req.body.numero).trim(),
    departamento: texto(req.body.departamento).trim(),
    comuna: texto(req.body.comuna).trim(),
    region: texto(req.body.region).trim(),
    codigoPostal: texto(req.body.codigoPostal).trim(),
    referencia: texto(req.body.referencia).trim(),
  };

  try {
    await fusionarPendiente(req, idCliente);

    const entrega = {};


    if (datos.direccion && datos.direccion !== 'nueva') {
      const idDireccion = Number(datos.direccion);
      if (!Number.isInteger(idDireccion) || idDireccion <= 0) {
        return await renderCarrito(req, res, { error: 'Elige una dirección de entrega para continuar.', datos, estado: 400 });
      }
      entrega.idDireccion = idDireccion;
    } else {
      const nueva = leerDireccionNueva(datos);
      if (nueva.error) {
        return await renderCarrito(req, res, { error: nueva.error, datos, estado: 400 });
      }
      entrega.nuevaDireccion = nueva.datos;
    }


    let idMetodoPago;
    if (datos.pago === 'paypal') {
      if (!paypalSandbox.configuracionPublica().enabled) {
        return await renderCarrito(req, res, { error: 'PayPal Sandbox no está disponible.', datos, estado: 503 });
      }
      try { entrega.paypalCotizacion = await tipoCambio.obtener(); }
      catch (err) {
        return await renderCarrito(req, res, { error: 'No se pudo actualizar la cotización USD/CLP. Intenta nuevamente.', datos, estado: 503 });
      }
      await db.query("INSERT INTO metodo_pago (nombre, activo) VALUES ('PayPal Sandbox', TRUE) ON DUPLICATE KEY UPDATE activo = TRUE");
      const [[metodoPaypal]] = await db.query("SELECT id_metodo FROM metodo_pago WHERE nombre = 'PayPal Sandbox'");
      idMetodoPago = metodoPaypal.id_metodo;
    } else {
      return await renderCarrito(req, res, { error: 'El único medio de pago disponible es PayPal Sandbox.', datos, estado: 400 });
    }
    if (!Number.isInteger(idMetodoPago) || idMetodoPago <= 0) {
      return await renderCarrito(req, res, { error: 'Elige un medio de pago para continuar.', datos, estado: 400 });
    }
    entrega.idMetodoPago = idMetodoPago;

    const pedido = await Carrito.confirmar(idCliente, req.session.usuario.id, null, entrega);
    req.session.carrito = [];
    void notificarPedido(pedido.id, 'confirmado');
    if (entrega.paypalCotizacion) return res.redirect('/carrito?pagar=' + pedido.id + '#pago-paypal');
    return res.redirect(`/pedidos/${pedido.id}/comprobante`);
  } catch (err) {

    if (!err.status) return next(err);
    try {
      return await renderCarrito(req, res, { error: err.message, datos, estado: err.status });
    } catch (errVista) {
      return next(errVista);
    }
  }
};
