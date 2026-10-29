// Reglas de venta de la tienda, en un solo lugar (HU-025, HU-029 y HU-030).
// Las usan el modelo del carrito (al confirmar) y las vistas (para mostrar el resumen),
// así el costo de envío y el IVA nunca quedan escritos con valores distintos en cada archivo.

// Los precios del catálogo incluyen IVA, como en el comercio chileno. El neto se calcula "hacia atrás".
const IVA = 0.19;

// Despacho: monto fijo y envío gratis desde cierto subtotal (en pesos, con IVA incluido).
const COSTO_ENVIO = 2990;
const ENVIO_GRATIS_DESDE = 15000;

// Valor neto (sin IVA) de un monto que ya incluye IVA.
const neto = (monto) => Math.round(monto / (1 + IVA));

// Parte del monto que corresponde al IVA.
const iva = (monto) => monto - neto(monto);

// Costo de despacho según el subtotal de productos: $0 si alcanza el mínimo para envío gratis.
const costoEnvio = (subtotal) => (subtotal >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO);

module.exports = { IVA, COSTO_ENVIO, ENVIO_GRATIS_DESDE, neto, iva, costoEnvio };
