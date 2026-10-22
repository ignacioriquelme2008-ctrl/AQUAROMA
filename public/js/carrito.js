// Carrito de compras. Lo comparten TODAS las páginas: se carga desde views/partials/navbar.ejs.
//
//  - Visitante sin sesión: el carrito vive solo en este navegador (localStorage).
//  - Cliente con sesión (HU-026): el carrito se guarda en su cuenta, en MySQL. localStorage queda
//    como copia rápida y cada cambio se envía al servidor (rutas /carrito/api en routes/carritoRoutes.js).
//
// Las páginas lo usan con window.AquaromaCarrito:
//   leer()        -> lista de productos [{ id, name, aroma, img, price, qty }]
//   guardar(lista)-> guarda la lista (y la envía a la cuenta si hay sesión)
//   agregar(datos)-> suma un producto (lo usan los botones "Agregar al carrito")
//   listo         -> promesa que se cumple cuando el carrito ya está al día con la cuenta
(function () {
  const CLAVE = 'aquaroma_carrito';
  // Espera después del último cambio antes de enviarlo, para no mandar una petición por cada clic en "+".
  const ESPERA_ENVIO_MS = 300;
  // Id del cliente con sesión. Lo escribe el servidor en el <script> del menú (data-cliente).
  // Vacío = visitante. El administrador tampoco tiene carrito guardado, porque no es cliente.
  const idCliente = Number(document.currentScript.dataset.cliente) || null;

  // En el navegador se guarda { dueno, items }. "dueno" es el id del cliente al que pertenece
  // la copia (null = visitante). Con eso se sabe si hay que unir carritos o borrar la copia.
  function leerCopia() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE));
      if (Array.isArray(guardado)) return { dueno: null, items: guardado }; // formato antiguo: solo la lista
      if (guardado && Array.isArray(guardado.items)) {
        return { dueno: guardado.dueno || null, items: guardado.items };
      }
    } catch (e) { /* dato dañado o almacenamiento bloqueado: se parte con el carrito vacío */ }
    return { dueno: null, items: [] };
  }

  function escribirCopia(items, dueno) {
    try { localStorage.setItem(CLAVE, JSON.stringify({ dueno, items })); } catch (e) { /* sin almacenamiento */ }
    actualizarContador(items);
  }

  // HU-022: contador de artículos del botón "Carrito" del menú (suma de unidades).
  // Se llama cada vez que se guarda el carrito, así siempre muestra lo mismo que la página del carrito.
  // Con el carrito vacío, el número se oculta.
  function actualizarContador(items) {
    const contador = document.querySelector('[data-contador-carrito]');
    if (!contador) return;
    const unidades = items.reduce((suma, i) => suma + (Number(i.qty) || 0), 0);
    contador.textContent = unidades > 99 ? '99+' : String(unidades);
    contador.hidden = unidades === 0;
    contador.setAttribute('aria-label', unidades + (unidades === 1 ? ' artículo' : ' artículos') + ' en el carrito');
  }

  // Al servidor solo se le manda qué producto y cuántas unidades. El nombre y el precio
  // los saca él de la base, así nadie puede cambiar un precio desde el navegador.
  const soloIdYCantidad = (items) => items.map((i) => ({ id: i.id, qty: i.qty }));

  // ---------- Envío de cambios a la cuenta (solo con sesión de cliente) ----------
  let temporizador = null;

  function enviar() {
    clearTimeout(temporizador);
    temporizador = null;
    return fetch('/carrito/api', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: soloIdYCantidad(leerCopia().items) }),
      keepalive: true, // la petición termina aunque la persona se cambie de página
    }).catch(() => { /* sin conexión: la copia local se mantiene y se envía con el próximo cambio */ });
  }

  // Si quedó un cambio esperando, lo envía ya (antes de salir de la página o de cerrar sesión).
  const enviarPendiente = () => (temporizador ? enviar() : Promise.resolve());

  async function pedirAlServidor(metodo, url, items) {
    const opciones = { method: metodo };
    if (items) {
      opciones.headers = { 'Content-Type': 'application/json' };
      opciones.body = JSON.stringify({ items: soloIdYCantidad(items) });
    }
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) throw new Error('El servidor respondió ' + respuesta.status);
    return (await respuesta.json()).items;
  }

  // ---------- Al abrir cualquier página: dejar el carrito al día ----------
  async function sincronizar() {
    const copia = leerCopia();

    if (!idCliente) {
      // Visitante. Si la copia era de un cliente (cerró sesión o se le venció), se borra:
      // su carrito sigue guardado en su cuenta y la próxima persona que use este computador no lo ve.
      if (copia.dueno !== null) escribirCopia([], null);
      return leerCopia().items;
    }

    try {
      let items;
      if (copia.dueno === null && copia.items.length > 0) {
        // Recién inició sesión y traía productos agregados como visitante:
        // se suman al carrito guardado en su cuenta (HU-026, criterio 2).
        items = await pedirAlServidor('POST', '/carrito/api/fusionar', copia.items);
      } else {
        // Manda lo guardado en la cuenta: así ve el mismo carrito en cualquier computador (criterio 1).
        items = await pedirAlServidor('GET', '/carrito/api');
      }
      escribirCopia(items, idCliente);
      return items;
    } catch (err) {
      // Si el servidor no responde, se sigue con la copia local (si es de este cliente o de visitante).
      console.error('No se pudo sincronizar el carrito con la cuenta:', err);
      return copia.dueno === idCliente || copia.dueno === null ? copia.items : [];
    }
  }

  actualizarContador(leerCopia().items);   // número inicial, antes de traer el carrito de la cuenta
  const listo = sincronizar();
  // Si el carrito cambia en otra pestaña del mismo navegador, el contador de esta también se actualiza.
  window.addEventListener('storage', (e) => { if (e.key === CLAVE) actualizarContador(leerCopia().items); });

  // ---------- Funciones que usan las páginas ----------
  function leer() {
    return leerCopia().items;
  }

  function guardar(items) {
    escribirCopia(items, idCliente);
    if (!idCliente) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(enviar, ESPERA_ENVIO_MS);
  }

  // Recibe los atributos data-* del producto (id, nombre, precio, imagen, aromaNombre).
  // Si el producto ya estaba en el carrito, solo suma una unidad.
  async function agregar(datos) {
    await listo; // primero el carrito debe estar al día con la cuenta, para no pisar lo guardado
    const items = leer();
    const existente = items.find((i) => i.id === Number(datos.id));
    if (existente) existente.qty = Math.min(existente.qty + 1, 99);
    else items.push({ id: Number(datos.id), name: datos.nombre, aroma: datos.aromaNombre, img: '/img/productos/' + datos.imagen, price: Number(datos.precio), qty: 1 });
    guardar(items);
  }

  // Antes de cerrar la pestaña o cambiar de página, se envía el último cambio pendiente.
  window.addEventListener('pagehide', enviarPendiente);

  document.addEventListener('DOMContentLoaded', () => {
    // Botones "Agregar al carrito" habilitados (catálogo y ficha del producto).
    // Los datos salen del elemento [data-id] que contiene al botón.
    document.querySelectorAll('.buy:not([disabled])').forEach((boton) => boton.addEventListener('click', async () => {
      await agregar(boton.closest('[data-id]').dataset);
      boton.textContent = 'Agregado ✓';
      setTimeout(() => { boton.textContent = 'Agregar al carrito'; }, 1500);
    }));

    // "Cerrar sesión": primero se envía el último cambio a la cuenta y después se borra la copia
    // de este navegador (HU-004 y HU-026). El carrito queda guardado en la cuenta para la próxima vez.
    const formSalir = document.querySelector('[data-cerrar-sesion]');
    if (formSalir) {
      formSalir.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        // Se espera como máximo 1,5 segundos: si el servidor no responde, igual se cierra la sesión.
        await Promise.race([enviarPendiente(), new Promise((r) => setTimeout(r, 1500))]);
        escribirCopia([], null);
        formSalir.submit(); // submit() no vuelve a disparar este evento
      });
    }
  });

  window.AquaromaCarrito = { leer, guardar, agregar, listo };
})();
