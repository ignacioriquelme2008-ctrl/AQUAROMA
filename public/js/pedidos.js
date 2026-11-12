
document.querySelectorAll('[data-confirmar-cancelacion]').forEach((form) => {
  form.addEventListener('submit', (evento) => {
    if (!window.confirm('¿Confirmas que quieres cancelar este pedido?')) evento.preventDefault();
  });
});
