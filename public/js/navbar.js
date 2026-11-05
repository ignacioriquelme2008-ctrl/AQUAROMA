(() => {
  const perfil = document.querySelector('.nav-perfil');
  if (!perfil) return;
  const opciones = perfil.querySelector('.nav-perfil-opciones');

  const ajustar = () => {
    if (!perfil.open) return;
    opciones.style.translate = '0px 0px';
    const rect = opciones.getBoundingClientRect();
    const margen = 16;
    const desplazamiento = rect.left < margen
      ? margen - rect.left
      : Math.min(0, document.documentElement.clientWidth - margen - rect.right);
    opciones.style.translate = `${desplazamiento}px 0px`;
  };

  perfil.addEventListener('toggle', ajustar);
  window.addEventListener('resize', ajustar);
  document.addEventListener('click', event => {
    if (!perfil.contains(event.target)) perfil.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && perfil.open) {
      perfil.open = false;
      perfil.querySelector('summary').focus();
    }
  });
  perfil.addEventListener('focusout', event => {
    if (!perfil.contains(event.relatedTarget)) perfil.open = false;
  });
  opciones.addEventListener('click', event => {
    if (event.target.closest('a')) perfil.open = false;
  });
  window.addEventListener('pageshow', () => { perfil.open = false; });
})();
