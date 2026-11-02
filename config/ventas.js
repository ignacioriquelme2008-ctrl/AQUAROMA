// Reglas de venta de la tienda, en un solo lugar (HU-025, HU-029 y HU-030).
// El costo de entrega se acuerda fuera del checkout y queda pendiente; aquí se calculan IVA y neto.

// Los precios del catálogo incluyen IVA, como en el comercio chileno. El neto se calcula "hacia atrás".
const IVA = 0.19;

// Valor neto (sin IVA) de un monto que ya incluye IVA.
const neto = (monto) => Math.round(monto / (1 + IVA));

// Parte del monto que corresponde al IVA.
const iva = (monto) => monto - neto(monto);

module.exports = { IVA, neto, iva };
