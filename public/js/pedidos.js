// HU-034: solicita confirmación antes de ejecutar una cancelación irreversible.
document.querySelectorAll('[data-confirmar-cancelacion]').forEach((form) => {
  form.addEventListener('submit', (evento) => {
    if (!window.confirm('¿Confirmas que quieres cancelar este pedido?')) evento.preventDefault();
  });
});
