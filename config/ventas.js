// Reglas de venta de la tienda, en un solo lugar (HU-020, HU-025, HU-029 y HU-030).
// El costo de entrega se acuerda fuera del checkout y queda pendiente; aquí se calculan IVA, neto
// y el precio de una bebida personalizada.

// Los precios del catálogo incluyen IVA, como en el comercio chileno. El neto se calcula "hacia atrás".
const IVA = 0.19;

// HU-020: la primera dosis de aroma está incluida. El recargo por dosis adicional
// depende del componente seleccionado y se obtiene de componente.recargo_precio.
const MAX_DOSIS_AROMA = 5;

// Valor neto (sin IVA) de un monto que ya incluye IVA.
const neto = (monto) => Math.round(monto / (1 + IVA));

// Parte del monto que corresponde al IVA.
const iva = (monto) => monto - neto(monto);

const recargoPersonalizacion = (intensidad = 1, recargoPorDosis = 0) => {
  const dosis = Number(intensidad);
  if (!Number.isInteger(dosis) || dosis < 1 || dosis > MAX_DOSIS_AROMA) return 0;
  const recargo = Number(recargoPorDosis);
  if (!Number.isFinite(recargo) || recargo < 0) return 0;
  return (dosis - 1) * recargo;
};

const precioPersonalizado = (precioBase, intensidad = 1, recargoPorDosis = 0) =>
  Number(precioBase) + recargoPersonalizacion(intensidad, recargoPorDosis);

module.exports = {
  IVA,
  MAX_DOSIS_AROMA,
  neto,
  iva,
  recargoPersonalizacion,
  precioPersonalizado,
};
