// Controlador de la sección CARRITO.
// Toda la lógica del carrito vive aquí (HU-022 a HU-030): la vista solo dibuja lo que el
// controlador le entrega. El navegador no guarda ni calcula nada.
//
//   - Visitante: el carrito se guarda en req.session.carrito (lo maneja este controlador).
//   - Cliente con sesión (HU-026): el carrito se guarda en su cuenta, en MySQL (models/Carrito).
//   - Cada cambio es un POST de formulario; al terminar se redirige (patrón PRG), así recargar
//     la página no repite la acción.
const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');
const Direccion = require('../models/Direccion');
const MetodoPago = require('../models/MetodoPago');
const ventas = require('../config/ventas');
const { texto } = require('../utils/validaciones');
const { MAX_CANTIDAD, normalizarItems } = require('../utils/carrito');

// Largo de cada campo de la dirección, igual que las columnas de la base.
const LARGO_DIRECCION = { calle: 150, numero: 20, departamento: 50, comuna: 100, region: 100, codigoPostal: 15, referencia: 255 };

// Ícono y color del círculo de cada aroma (solo presentación de la vista del carrito).
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

// Después de una acción solo se permite volver a una página interna del sitio.
const rutaSegura = (ruta) => (typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : '');

const idClienteDe = (req) => (req.session.usuario && req.session.usuario.idCliente) || null;

// HU-025: totales del resumen. Los precios incluyen IVA; el envío es gratis desde el mínimo.
function calcularTotales(items) {
  const subtotal = items.reduce((suma, i) => suma + i.subtotal, 0);
  const unidades = items.reduce((suma, i) => suma + i.qty, 0);
  const envio = items.length > 0 ? ventas.costoEnvio(subtotal) : 0;
  return {
    unidades,
    subtotal,
    neto: ventas.neto(subtotal),
    iva: ventas.iva(subtotal),
    envio,
    total: subtotal + envio,
    envioGratis: items.length > 0 && subtotal >= ventas.ENVIO_GRATIS_DESDE,
  };
}

// Agrega el ícono y el color de cada aroma para que la vista no tenga que decidirlos.
const adornar = (items) => items.map((i) => {
  const [icono, color] = ESTILOS_AROMA[i.aroma] || ['💧', '#e0f2fe'];
  return { ...i, icono, color };
});

// HU-026: si alguien armó un carrito como visitante y su fusión con la cuenta quedó pendiente
// (por ejemplo, el login no alcanzó a guardarla), se une la próxima vez que abra el carrito.
async function fusionarPendiente(req, idCliente) {
  const pendientes = normalizarItems(req.session.carrito);
  if (pendientes.length === 0) return;
  await Carrito.fusionar(idCliente, pendientes);
  req.session.carrito = [];
}

// Devuelve las líneas del carrito actual como [{ id, qty }], sin importar si es de sesión o de cuenta.
async function leerCarrito(req) {
  const idCliente = idClienteDe(req);
  if (idCliente) {
    await fusionarPendiente(req, idCliente);
    return Carrito.obtenerLineas(idCliente);
  }
  return normalizarItems(req.session.carrito);
}

// Reemplaza el carrito completo. El controlador ya decidió qué productos y cantidades van.
async function guardarCarrito(req, lineas) {
  const items = normalizarItems(lineas);
  const idCliente = idClienteDe(req);
  if (idCliente) {
    await Carrito.guardar(idCliente, items);
  } else {
    req.session.carrito = items;
  }
}

// Arma y muestra la página del carrito. Se usa al abrirla y también cuando la confirmación
// falla, para no perder lo que la persona había elegido (dirección y medio de pago).
async function renderCarrito(req, res, { error = null, datos = {}, estado = 200 } = {}) {
  const idCliente = idClienteDe(req);
  const [lineas, direcciones, metodos] = await Promise.all([
    leerCarrito(req),
    idCliente ? Direccion.listarDeCliente(idCliente) : Promise.resolve([]),
    MetodoPago.listarActivos(),
  ]);
  const items = adornar(await Producto.detallarCarrito(lineas));
  // HU-027: el límite corresponde al producto completo, aunque haya varias preparaciones
  // personalizadas del mismo producto (por ejemplo, aromas o intensidades distintos).
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
    error,
    datos,
  });
}

// GET /carrito
// HU-029 y HU-030: la página muestra las direcciones guardadas y los medios de pago activos.
// Un visitante también puede ver su carrito; la dirección solo se guarda cuando confirma con sesión.
exports.ver = async (req, res, next) => {
  try {
    await renderCarrito(req, res);
  } catch (err) {
    next(err);
  }
};

// POST /carrito/agregar -> HU-022. Suma una unidad del producto indicado (o lo crea en el carrito).
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
        req.session.avisoCarrito = 'El aroma elegido no está disponible para este producto.';
        return res.redirect(volver);
      }
      intensidad = Number(texto(req.body.intensidad).trim());
      if (!Number.isInteger(intensidad) || intensidad < 1 || intensidad > 5) {
        req.session.avisoCarrito = 'Elige una intensidad del aroma entre 1 y 5 dosis.';
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

// POST /carrito/cantidad -> HU-023. Los botones − / + mandan accion=restar|sumar y la casilla
// manda accion=fijar con la cantidad escrita. HU-027: nunca se supera el stock disponible.
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

    // Bajar a cero (o menos) equivale a eliminar el producto.
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

    // Si el stock bajó mientras el carrito estaba guardado, siempre se permite reducir;
    // cualquier incremento se limita al remanente del producto entre todas sus variantes.
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

// POST /carrito/eliminar -> HU-024. Quita el producto del carrito.
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

// HU-029: revisa la dirección nueva escrita en el carrito. Devuelve { datos } o { error }.
function leerDireccionNueva(fuente) {
  const d = {
    calle: texto(fuente.calle).trim(),
    numero: texto(fuente.numero).trim(),
    departamento: texto(fuente.departamento).trim(),
    comuna: texto(fuente.comuna).trim(),
    region: texto(fuente.region).trim(),
    codigoPostal: texto(fuente.codigoPostal).trim(),
    referencia: texto(fuente.referencia).trim(),
  };
  if (!d.calle) return { error: 'Ingresa la calle de la dirección de entrega.' };
  if (!d.comuna) return { error: 'Ingresa la comuna de la dirección de entrega.' };
  if (!d.region) return { error: 'Ingresa la región de la dirección de entrega.' };
  for (const [campo, largo] of Object.entries(LARGO_DIRECCION)) {
    if (d[campo] && d[campo].length > largo) {
      return { error: `Uno de los datos de la dirección es demasiado largo (máximo ${largo} caracteres).` };
    }
  }
  return { datos: d };
}

// POST /carrito/confirmar -> HU-028: confirma la compra y genera la orden.
// El carrito que se confirma es el guardado en la cuenta: el navegador ya no manda líneas,
// así nadie puede alterar precios ni cantidades desde afuera.
// HU-029: recibe la dirección elegida o una nueva. HU-030: recibe el medio de pago.
exports.confirmar = async (req, res, next) => {
  const idCliente = idClienteDe(req);
  // HU-004: confirmar es una acción privada. Sin sesión se va al login con vuelta al carrito
  // y, al entrar, el carrito de visitante se fusiona con la cuenta (HU-026).
  if (!idCliente) return res.redirect('/login?volver=' + encodeURIComponent('/carrito'));

  // Se guarda lo que la persona escribió para poder volver a mostrarlo si algo falla.
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

    // Dirección: una guardada del cliente o una nueva que se escribe en el carrito.
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

    // Medio de pago: el modelo comprueba además que exista y esté activo.
    const idMetodoPago = Number(datos.pago);
    if (!Number.isInteger(idMetodoPago) || idMetodoPago <= 0) {
      return await renderCarrito(req, res, { error: 'Elige un medio de pago para continuar.', datos, estado: 400 });
    }
    entrega.idMetodoPago = idMetodoPago;

    const pedido = await Carrito.confirmar(idCliente, req.session.usuario.id, null, entrega);
    req.session.carrito = [];
    return res.redirect(`/pedidos/${pedido.id}/comprobante`);
  } catch (err) {
    // Los errores de negocio (carrito vacío, stock insuficiente) se muestran en el carrito.
    if (!err.status) return next(err);
    try {
      return await renderCarrito(req, res, { error: err.message, datos, estado: err.status });
    } catch (errVista) {
      return next(errVista);
    }
  }
};
