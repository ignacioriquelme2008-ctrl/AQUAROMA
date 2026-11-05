(() => {
  const form = document.getElementById('confirmar-pedido');
  const campos = document.getElementById('direccion-nueva');
  if (!form || !campos) return;
  const opciones = form.querySelectorAll('input[name="direccion"]');
  const actualizar = () => {
    const seleccionada = form.querySelector('input[name="direccion"]:checked');
    campos.hidden = opciones.length > 0 && seleccionada?.value !== 'nueva';
  };
  opciones.forEach(opcion => opcion.addEventListener('change', actualizar));
  window.addEventListener('pageshow', actualizar);
  actualizar();
})();
