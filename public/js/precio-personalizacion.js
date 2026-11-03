// HU-020: refleja en la ficha el recargo de intensidad antes de agregar el producto.
// El servidor vuelve a calcular el total y nunca confía en este valor visual.
(() => {
  const selector = document.getElementById('intensidad-aroma');
  const precio = document.getElementById('precio-personalizado');
  const ayuda = document.getElementById('ayuda-recargo-dosis');
  const opcionesAroma = [...document.querySelectorAll('input[name="idComponente"]')];
  if (!selector || !precio || opcionesAroma.length === 0) return;

  const base = Number(precio.dataset.precioBase);
  const formato = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });

  const actualizarPrecio = () => {
    const dosis = Number(selector.value);
    const aroma = opcionesAroma.find((opcion) => opcion.checked);
    const recargoPorDosis = Number(aroma?.dataset.recargoDosis) || 0;
    const total = base + Math.max(0, dosis - 1) * recargoPorDosis;
    precio.textContent = formato.format(total);
    if (ayuda) {
      ayuda.textContent = `La primera dosis está incluida; cada dosis adicional suma ${formato.format(recargoPorDosis)}.`;
    }
  };

  selector.addEventListener('change', actualizarPrecio);
  opcionesAroma.forEach((opcion) => opcion.addEventListener('change', actualizarPrecio));
  actualizarPrecio();
})();
