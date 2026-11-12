


const cajaEnvio = document.getElementById('datos-envio');
if (cajaEnvio) {
  const radios = document.querySelectorAll('[data-estado]');
  const actualizar = () => {
    const elegido = document.querySelector('[data-estado]:checked');
    cajaEnvio.hidden = !elegido || elegido.value !== 'enviado';
  };
  radios.forEach((r) => r.addEventListener('change', actualizar));
  actualizar();
}
