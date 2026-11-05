(() => {
  const filtros = document.querySelector('.catalogo-filtros');
  if (!filtros) return;
  const form = filtros.querySelector('form');
  const resultados = document.querySelector('.layout');
  const cuenta = document.querySelector('.count');
  const resumen = filtros.querySelector('summary');
  let solicitud;

  const pestanas = [...form.querySelectorAll('[role="tab"]')];
  const mostrarCategoria = pestaña => {
    pestanas.forEach(boton => {
      const seleccionada = boton === pestaña;
      boton.setAttribute('aria-selected', String(seleccionada));
      boton.tabIndex = seleccionada ? 0 : -1;
      document.getElementById(boton.getAttribute('aria-controls')).hidden = !seleccionada;
    });
  };
  pestanas.forEach((boton, indice) => {
    const panel = document.getElementById(boton.getAttribute('aria-controls'));
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', boton.id);
    boton.addEventListener('click', () => mostrarCategoria(boton));
    boton.addEventListener('keydown', event => {
      let siguiente;
      if (event.key === 'ArrowRight') siguiente = (indice + 1) % pestanas.length;
      else if (event.key === 'ArrowLeft') siguiente = (indice - 1 + pestanas.length) % pestanas.length;
      else if (event.key === 'Home') siguiente = 0;
      else if (event.key === 'End') siguiente = pestanas.length - 1;
      else return;
      event.preventDefault();
      mostrarCategoria(pestanas[siguiente]);
      pestanas[siguiente].focus();
    });
  });
  form.dataset.pestanas = 'true';
  form.querySelector('.filtros-pestanas').hidden = false;
  mostrarCategoria(pestanas[0]);

  document.addEventListener('click', event => {
    if (!filtros.contains(event.target)) filtros.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && filtros.open) {
      filtros.open = false;
      resumen.focus();
    }
  });
  filtros.addEventListener('focusout', event => {
    if (!filtros.contains(event.relatedTarget)) filtros.open = false;
  });
  const todos = filtros.querySelector('input[name="aroma"][value="todos"]');
  const aromas = [...filtros.querySelectorAll('input[name="aroma"]')].filter(input => input !== todos);

  const urlSeleccionada = () => {
    const url = new URL(form.action);
    const parametros = new URLSearchParams(new FormData(form));
    for (const [nombre, valor] of parametros) {
      if (valor !== 'todos') url.searchParams.append(nombre, valor);
    }
    return url;
  };

  const actualizar = async (url, guardarHistorial = true) => {
    solicitud?.abort();
    const actual = new AbortController();
    solicitud = actual;
    resultados.setAttribute('aria-busy', 'true');
    try {
      const respuesta = await fetch(url, { signal: actual.signal });
      if (!respuesta.ok) throw new Error('No se pudo actualizar el catálogo');
      const html = await respuesta.text();
      if (actual !== solicitud) return;
      const pagina = new DOMParser().parseFromString(html, 'text/html');
      const listado = pagina.querySelector('.layout');
      const contador = pagina.querySelector('.count');
      const nuevoResumen = pagina.querySelector('.catalogo-filtros summary');
      if (!listado || !contador || !nuevoResumen) throw new Error('Catálogo no disponible');
      resultados.innerHTML = listado.innerHTML;
      cuenta.textContent = contador.textContent;
      resumen.innerHTML = nuevoResumen.innerHTML;
      if (guardarHistorial && url.href !== location.href) history.pushState(null, '', url);
    } catch (error) {
      if (error.name !== 'AbortError' && actual === solicitud) location.assign(url.href);
    } finally {
      if (actual === solicitud) resultados.removeAttribute('aria-busy');
    }
  };

  form.addEventListener('change', event => {
    if (event.target === todos) {
      if (todos.checked) aromas.forEach(input => { input.checked = false; });
      else todos.checked = !aromas.some(input => input.checked);
    } else if (aromas.includes(event.target)) {
      todos.checked = !aromas.some(input => input.checked);
    }
    actualizar(urlSeleccionada());
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    actualizar(urlSeleccionada());
  });
  filtros.querySelector('.clear').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    form.querySelectorAll('input').forEach(input => { input.checked = input.value === 'todos'; });
    actualizar(new URL(form.action));
  });
  const restaurar = () => {
    const url = new URL(location.href);
    ['aroma', 'tipo'].forEach(nombre => {
      const valores = url.searchParams.getAll(nombre).filter(valor => valor && valor !== 'todos');
      form.querySelectorAll(`input[name="${nombre}"]`).forEach(input => {
        input.checked = input.value === 'todos' ? valores.length === 0 : valores.includes(input.value);
      });
    });
  };
  window.addEventListener('popstate', () => {
    restaurar();
    actualizar(new URL(location.href), false);
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      restaurar();
      actualizar(new URL(location.href), false);
    }
  });
})();
