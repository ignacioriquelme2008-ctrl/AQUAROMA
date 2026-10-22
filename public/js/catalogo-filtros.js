// Filtros del catálogo (views/catalogo/catalogo.ejs): por aroma (HU-014) y por tipo de agua (HU-015).
// Los productos ya están todos en la página; los filtros solo muestran u ocultan tarjetas.
const form = document.getElementById('filtros'),
  items = [...document.querySelectorAll('.item')],
  count = document.getElementById('count'),
  empty = document.getElementById('empty'),
  aromas = [...form.querySelectorAll('[name=aroma]')],
  todos = aromas[0];

// Combina los filtros y actualiza las tarjetas visibles, el contador y el aviso de resultados vacíos.
function apply() {
  const sel = aromas.filter((a) => a.checked && a !== todos).map((a) => a.value);
  const tipo = form.tipo.value;
  let n = 0;
  items.forEach((i) => {
    const ok = (!sel.length || sel.includes(i.dataset.aroma)) && (tipo === 'todos' || i.dataset.tipo === tipo);
    i.hidden = !ok;
    if (ok) n++;
  });
  count.textContent = 'Mostrando ' + n + (n === 1 ? ' producto' : ' productos');
  empty.hidden = n > 0;
}

// Mantiene la opción "Todos" coherente con las selecciones y vuelve a filtrar al cambiar aroma o tipo.
form.addEventListener('change', (e) => {
  if (e.target.name === 'aroma') {
    if (e.target === todos && todos.checked) aromas.forEach((a) => { if (a !== todos) a.checked = false; });
    else if (e.target !== todos) todos.checked = !aromas.some((a) => a !== todos && a.checked);
  }
  apply();
});

// "Limpiar filtros" es un botón type="reset": el navegador desmarca todo y después se vuelve a filtrar.
form.addEventListener('reset', () => setTimeout(apply));
