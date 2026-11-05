(() => {
  const clave = 'aquaroma-tema';
  const sistema = window.matchMedia('(prefers-color-scheme: dark)');
  let preferencia;
  let boton;

  try {
    preferencia = localStorage.getItem(clave);
  } catch {
    // La preferencia del sistema sigue disponible si el navegador bloquea el almacenamiento.
  }

  function aplicarTema() {
    const oscuro = preferencia === 'oscuro' || (preferencia !== 'claro' && sistema.matches);
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
    boton?.setAttribute('aria-pressed', String(oscuro));
  }

  aplicarTema();
  sistema.addEventListener('change', aplicarTema);
  window.addEventListener('storage', (evento) => {
    if (evento.key !== clave && evento.key !== null) return;
    preferencia = evento.newValue;
    aplicarTema();
  });

  document.addEventListener('DOMContentLoaded', () => {
    boton = document.querySelector('.nav-tema');
    if (!boton) return;
    aplicarTema();
    boton.hidden = false;
    boton.addEventListener('click', () => {
      preferencia = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
      try {
        localStorage.setItem(clave, preferencia);
      } catch {
        // El botón sigue funcionando durante la visita.
      }
      aplicarTema();
    });
  });
})();
