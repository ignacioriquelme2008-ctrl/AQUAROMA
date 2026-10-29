// Reglas compartidas del carrito (HU-022 a HU-027).
// Las usan el controlador del carrito y el login (HU-026), para que la sesión y la cuenta
// guarden el mismo formato: [{ id, qty, idComponente?, intensidad? }].

// Máximo de productos distintos que se aceptan en una petición (evita listas gigantes).
const MAX_PRODUCTOS = 100;

// Tope de unidades por producto. HU-027 además lo limita al stock real de la base.
const MAX_CANTIDAD = 99;

// Deja solo datos válidos: descarta ids o cantidades incorrectas, junta líneas con el mismo
// producto y aroma elegido y aplica el tope de unidades. Nombre y precio nunca vienen del navegador.
function normalizarItems(lista) {
  if (!Array.isArray(lista)) return [];
  const cantidades = new Map();
  for (const item of lista.slice(0, MAX_PRODUCTOS)) {
    const id = Number(item && item.id);
    const qty = Math.floor(Number(item && item.qty));
    if (!Number.isInteger(id) || id <= 0 || !(qty >= 1)) continue;
    const valorComponente = Number(item && item.idComponente);
    const idComponente = Number.isInteger(valorComponente) && valorComponente > 0 ? valorComponente : null;
    const valorIntensidad = Number(item && item.intensidad);
    const intensidad = idComponente
      ? (Number.isInteger(valorIntensidad) && valorIntensidad >= 1 && valorIntensidad <= 5 ? valorIntensidad : 1)
      : null;
    const clave = `${id}:${idComponente || 0}:${intensidad || 0}`;
    const anterior = cantidades.get(clave);
    cantidades.set(clave, {
      id,
      qty: Math.min((anterior ? anterior.qty : 0) + qty, MAX_CANTIDAD),
      ...(idComponente ? { idComponente, intensidad } : {}),
    });
  }
  return [...cantidades.values()];
}

module.exports = { MAX_PRODUCTOS, MAX_CANTIDAD, normalizarItems };
