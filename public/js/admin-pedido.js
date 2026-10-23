// Detalle de un pedido en el panel (views/admin/pedido.ejs, HU-040).
// Los campos "Empresa de transporte" y "Código de seguimiento" solo se muestran cuando se elige "Enviado".
// Sin JavaScript se ven siempre, y el servidor igual los exige solo para "Enviado".
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
