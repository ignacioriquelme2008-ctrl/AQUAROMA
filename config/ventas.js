




const IVA = 0.19;



const MAX_DOSIS_AROMA = 5;


const neto = (monto) => Math.round(monto / (1 + IVA));


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
