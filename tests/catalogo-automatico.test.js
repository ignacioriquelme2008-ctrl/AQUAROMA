const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function escenario(fetchImpl) {
  const eventos = () => ({
    handlers: {},
    addEventListener(nombre, fn) { this.handlers[nombre] = fn; },
  });
  const resultados = { ...eventos(), innerHTML: 'productos iniciales', enfocado: false,
    contains() { return this.enfocado; }, setAttribute() {}, removeAttribute() {} };
  const cuenta = { textContent: '1 producto' };
  const resumen = { innerHTML: 'Filtros', focus() {} };
  const todos = { value: 'todos', checked: false };
  const limon = { value: 'limon', checked: true };
  const form = { ...eventos(), action: 'http://localhost/catalogo', dataset: {},
    querySelectorAll() { return []; },
    querySelector() { return {}; } };
  const filtros = { ...eventos(), open: true,
    querySelector(selector) {
      if (selector === 'form') return form;
      if (selector === 'summary') return resumen;
      if (selector === '.clear') return eventos();
      return todos;
    }, querySelectorAll() { return [todos, limon]; }, contains() { return true; } };
  const document = { ...eventos(), hidden: false, activeElement: {},
    querySelector(selector) { return ({ '.catalogo-filtros': filtros, '.layout': resultados, '.count': cuenta })[selector]; } };
  const window = { ...eventos(), setInterval(fn, ms) { this.tick = fn; this.periodo = ms; return 1; }, clearInterval() {}, setTimeout };
  const cambiosHistorial = [], redirecciones = [], llamadas = [];
  const location = { href: 'http://localhost/catalogo?aroma=limon', assign(url) { redirecciones.push(url); } };
  class DOMParser {
    parseFromString(html) { return {
      querySelector(selector) { return ({ '.layout': { innerHTML: html }, '.count': { textContent: '2 productos' }, '.catalogo-filtros summary': { innerHTML: 'Filtros (1)' } })[selector]; },
    }; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/catalogo-filtros.js'), 'utf8'), {
    document, window, location, URL, AbortController, DOMParser,
    history: { pushState(...args) { cambiosHistorial.push(args); } },
    fetch: async (...args) => { llamadas.push(args); return fetchImpl(...args); },
  });
  return { window, document, resultados, filtros, limon, cambiosHistorial, redirecciones, llamadas };
}

test('refresca el catálogo sin perder filtros ni crear historial', async () => {
  const e = escenario(async () => ({ ok: true, text: async () => 'productos nuevos' }));
  assert.equal(e.window.periodo, 5000);
  await e.window.tick();
  assert.equal(e.resultados.innerHTML, 'productos nuevos');
  assert.equal(e.llamadas[0][0].search, '?aroma=limon');
  assert.equal(e.llamadas[0][1].cache, 'no-store');
  assert.equal(e.filtros.open, true);
  assert.equal(e.limon.checked, true);
  assert.equal(e.cambiosHistorial.length, 0);
});

test('no refresca pestañas ocultas ni interrumpe el foco en productos', async () => {
  const e = escenario(async () => ({ ok: true, text: async () => 'nuevo' }));
  e.document.hidden = true;
  await e.window.tick();
  e.document.hidden = false;
  e.resultados.enfocado = true;
  await e.window.tick();
  assert.equal(e.llamadas.length, 0);
});

test('un fallo de red conserva el catálogo y permite volver a intentar', async () => {
  let fallo = true;
  const e = escenario(async () => { if (fallo) throw Error('Sin conexión'); return { ok: true, text: async () => 'recuperado' }; });
  await e.window.tick();
  assert.equal(e.resultados.innerHTML, 'productos iniciales');
  assert.equal(e.redirecciones.length, 0);
  fallo = false;
  await e.window.tick();
  assert.equal(e.resultados.innerHTML, 'recuperado');
});

test('evita consultas simultáneas y no reemplaza un producto durante un clic', async () => {
  let resolver;
  const e = escenario(() => new Promise(resolve => { resolver = resolve; }));
  const primera = e.window.tick();
  await e.window.tick();
  assert.equal(e.llamadas.length, 1);
  e.resultados.handlers.pointerdown();
  resolver({ ok: true, text: async () => 'nuevo' });
  await primera;
  assert.equal(e.resultados.innerHTML, 'productos iniciales');
});
