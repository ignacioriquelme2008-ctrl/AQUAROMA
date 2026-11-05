// El pedido y su cotización se guardan en el servidor antes de abrir PayPal.
(() => {
  const container = document.getElementById('paypal-button-container');
  const resultado = document.getElementById('paypal-resultado');
  const reintentar = document.getElementById('paypal-reintentar');
  if (!container || !resultado) return;
  const base = '/api/paypal-sandbox/pedidos/' + encodeURIComponent(container.dataset.pedido);
  let orderID;
  const mostrar = (mensaje, tipo = '') => {
    resultado.textContent = mensaje;
    resultado.className = 'paypal-resultado ' + tipo;
  };
  async function solicitar(path, body) {
    const response = await fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar el pago.');
    if (data.completed && data.redirect) window.location.assign(data.redirect);
    return data;
  }
  async function capturar() {
    reintentar.hidden = true;
    mostrar('Verificando tu pago…');
    try { await solicitar('/capture', { orderID }); }
    catch (err) { mostrar(err.message, 'error'); reintentar.hidden = false; }
  }
  reintentar.addEventListener('click', capturar);
  if (!window.paypal) { mostrar('No se pudo cargar PayPal. Revisa tu conexión y recarga la página.', 'error'); return; }
  window.paypal.Buttons({
    fundingSource: window.paypal.FUNDING.PAYPAL,
    style: { label: 'paypal', tagline: false, color: 'gold', shape: 'rect' },
    createOrder: async () => {
      try {
        mostrar('Conectando con PayPal…');
        const data = await solicitar('/orders');
        orderID = data.id;
        return data.id;
      } catch (err) { mostrar(err.message, 'error'); throw err; }
    },
    onApprove: async (data) => { orderID = data.orderID; await capturar(); },
    onCancel: () => mostrar('No se completó el pago. Puedes intentarlo de nuevo o revisar tu pedido.', 'aviso'),
    onError: () => { if (!resultado.classList.contains('error')) mostrar('PayPal no pudo completar la operación. Intenta nuevamente.', 'error'); },
  }).render(container).catch(() => mostrar('No se pudo mostrar el botón de PayPal. Recarga la página.', 'error'));
})();
