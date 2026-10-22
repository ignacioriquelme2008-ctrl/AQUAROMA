// Página del carrito (views/carrito/carrito.ejs): dibuja los productos, permite cambiar cantidades
// y eliminar, y calcula el resumen del pedido (HU-022 a HU-026).
//
// Los datos los maneja public/js/carrito.js (se carga desde el menú): los guarda en el navegador
// y, si hay un cliente con sesión, también en su cuenta (HU-026). Aquí solo se leen y se guardan.
let cart = AquaromaCarrito.leer();
const guardar = () => AquaromaCarrito.guardar(cart);
// Mientras se trae el carrito de la cuenta no se permite editar, para no pisar lo guardado.
let editable = false;

// Cantidad permitida por producto. El máximo es un tope de seguridad; HU-027 lo limitará al stock real.
const MIN_CANTIDAD = 1, MAX_CANTIDAD = 99;

// Convierte lo que escribió la persona en una cantidad válida: entero entre el mínimo y el máximo.
const normalizar = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < MIN_CANTIDAD) return MIN_CANTIDAD;
  return Math.min(n, MAX_CANTIDAD);
};
cart.forEach((i) => { i.qty = normalizar(i.qty); });

// Ícono y color de fondo según el aroma del producto.
const ESTILOS = {
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
const estilo = (aroma) => ESTILOS[aroma] || ['💧', '#e0f2fe'];

// $('id') es un atajo de document.getElementById('id').
const $ = (id) => document.getElementById(id);
// Formato de dinero chileno: 13410 -> "$13.410" (HU-025).
const m = (n) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Cada render actualiza la vista para que el usuario vea siempre el carrito con cantidades y precios correctos.
// "guardarCambios" es false cuando solo se muestra lo que ya estaba guardado (al cargar la página).
function render(guardarCambios = true) {
  $('items').innerHTML = cart.map((i) => `
  <div class="row item">
    <div class="prod"><img src="${i.img}" alt="${i.name}"><div><strong>${i.name}</strong><small>Botella con aroma</small><small>Aroma: ${i.aroma}</small></div></div>
    <div class="aroma"><span class="ic" style="background:${estilo(i.aroma)[1]}">${estilo(i.aroma)[0]}</span>${i.aroma}</div>
    <div class="qty"><button data-a="-" data-id="${i.id}" aria-label="Quitar uno">−</button><input class="qty-input" type="number" inputmode="numeric" min="${MIN_CANTIDAD}" max="${MAX_CANTIDAD}" step="1" value="${i.qty}" data-id="${i.id}" aria-label="Cantidad de ${i.name}"><button data-a="+" data-id="${i.id}" aria-label="Agregar uno">+</button></div>
    <div class="price"><b>${m(i.price)} c/u</b><b data-sub="${i.id}">${m(i.price * i.qty)}</b></div>
    <button class="del" data-a="x" data-id="${i.id}" aria-label="Eliminar ${i.name}"><svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true"><g class="trash-body"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></g><path class="trash-lid" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span class="del-label">Eliminar</span></button>
  </div>`).join('');
  actualizarResumen(guardarCambios);
}

// Recalcula el resumen y guarda el carrito. Se separó de render() para poder usarlo mientras
// la persona escribe la cantidad, sin redibujar la fila (si se redibuja, el cursor sale del campo).
function actualizarResumen(guardarCambios = true) {
  // Suma precio por cantidad; el envío aún no se cobra (se define en HU-028), así que el subtotal y el total son iguales.
  const total = cart.reduce((suma, i) => suma + i.price * i.qty, 0);
  $('subtotal').textContent = m(total);
  $('total').textContent = m(total);
  $('subLabel').textContent = 'Subtotal (' + cart.length + (cart.length === 1 ? ' producto)' : ' productos)');
  // Si no hay productos, se muestra el mensaje de carrito vacío y se desactiva el botón de confirmar.
  $('empty').hidden = cart.length > 0;
  $('confirm').disabled = !cart.length;
  if (guardarCambios) guardar();
}

// Los botones del carrito modifican la cantidad o eliminan el producto para mantener el estado actualizado.
$('items').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !editable) return;

  const i = cart.find((x) => x.id == b.dataset.id);
  if (!i) return;

  if (b.dataset.a === '+') {
    i.qty = Math.min(MAX_CANTIDAD, i.qty + 1);
  } else if (b.dataset.a === '-') {
    i.qty = Math.max(MIN_CANTIDAD, i.qty - 1);
  } else if (b.dataset.a === 'x') {
    // Eliminar: primero se ve la animación del botón (carrito.css) y después se quita la fila.
    b.disabled = true;
    b.classList.add('is-success');
    setTimeout(() => {
      cart = cart.filter((x) => x !== i);
      render();
    }, 800);
    return;
  }

  render();
});

// La cantidad también se puede escribir (observación del profesor: con solo "+" no era práctico).
// Mientras escribe: si el número es válido, se actualizan el subtotal de la fila y el resumen al instante.
$('items').addEventListener('input', (e) => {
  if (!e.target.classList.contains('qty-input') || !editable) return;
  const i = cart.find((x) => x.id == e.target.dataset.id);
  if (!i) return;
  const n = parseInt(e.target.value, 10);
  if (Number.isNaN(n) || n < MIN_CANTIDAD) return; // campo vacío o en 0: se espera a que termine de escribir
  i.qty = Math.min(n, MAX_CANTIDAD);
  if (n > MAX_CANTIDAD) e.target.value = MAX_CANTIDAD;
  document.querySelector('[data-sub="' + i.id + '"]').textContent = m(i.price * i.qty);
  actualizarResumen();
});

// Al salir del campo (o con Enter): si quedó vacío, en 0, negativo o con decimales, se corrige a un valor válido.
$('items').addEventListener('change', (e) => {
  if (!e.target.classList.contains('qty-input') || !editable) return;
  const i = cart.find((x) => x.id == e.target.dataset.id);
  if (!i) return;
  i.qty = normalizar(e.target.value);
  // Se actualiza solo esta fila (no se redibuja la lista con render()). Si se redibujara, el botón que
  // la persona estaba presionando (Eliminar, + o −) se reemplazaría a mitad del clic y ese clic se perdería.
  e.target.value = i.qty;
  document.querySelector('[data-sub="' + i.id + '"]').textContent = m(i.price * i.qty);
  actualizarResumen();
});

$('items').addEventListener('keydown', (e) => {
  if (e.target.classList.contains('qty-input') && e.key === 'Enter') e.target.blur();
});

// HU-004: sin sesión no se puede confirmar. Se manda al login con volver=/carrito: después de entrar,
// la persona vuelve aquí y sus productos se suman a su cuenta (HU-026), así que no pierde nada.
// Con sesión, por ahora solo hay confirmación visual: el pedido se registrará en MySQL con la HU-028.
$('confirm').addEventListener('click', () => {
  if ($('confirm').dataset.requiereLogin) {
    window.location.href = '/login?volver=' + encodeURIComponent('/carrito');
    return;
  }
  $('confirm').textContent = '¡Pedido confirmado! ✓';
});

// Primero se muestra la copia del navegador (es instantánea). Cuando llega el carrito de la cuenta
// (o al tiro, si es visitante), se vuelve a dibujar con esos datos y recién ahí se puede editar.
render(false);
AquaromaCarrito.listo.then((items) => {
  cart = items;
  cart.forEach((i) => { i.qty = normalizar(i.qty); });
  editable = true;
  render(false);
});
