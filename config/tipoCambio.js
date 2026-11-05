// Tipo de cambio de referencia diario USD/CLP de ExchangeRate-API Open Access.
// La tasa se mantiene en memoria para evitar llamadas repetidas a cada vista del carrito.
const URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_STALE_MS = 48 * 60 * 60 * 1000;

let cache = null;
let consultando = null;

async function obtener() {
  if (cache && Date.now() - cache.consultadoEn < CACHE_MS && Date.now() - cache.actualizadoEn < MAX_STALE_MS) return cache;
  if (consultando) return consultando;

  consultando = (async () => {
    try {
      const response = await fetch(URL, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) throw new Error(`ExchangeRate-API respondió HTTP ${response.status}`);
      const data = await response.json();
      const tasa = Number(data.rates && data.rates.CLP);
      const actualizadoEn = Number(data.time_last_update_unix) * 1000;
      if (data.result !== 'success' || data.base_code !== 'USD' || !Number.isFinite(tasa) || !(tasa > 0)
          || !Number.isFinite(actualizadoEn) || !actualizadoEn
          || Date.now() - actualizadoEn > MAX_STALE_MS || actualizadoEn > Date.now() + 300000) {
        throw new Error('Respuesta inválida de ExchangeRate-API');
      }
      cache = { tasa, actualizadoEn, consultadoEn: Date.now(), fuente: 'ExchangeRate-API Open Access' };
      return cache;
    } catch (error) {
      if (cache && Date.now() - cache.actualizadoEn < MAX_STALE_MS) {
        return { ...cache, desactualizada: true };
      }
      throw error;
    } finally {
      consultando = null;
    }
  })();

  return consultando;
}

// Usa todos los decimales de la tasa; solo redondea el importe final a centavos.
function convertir(clp, tasa) {
  const pesos = Math.round(Number(clp) * 100);
  const cambio = Math.round(Number(tasa) * 1e8);
  if (!Number.isSafeInteger(pesos) || pesos <= 0 || !Number.isSafeInteger(cambio) || cambio <= 0) {
    throw new Error('Monto o tipo de cambio inválido.');
  }
  const centavos = (BigInt(pesos) * 100000000n + BigInt(Math.floor(cambio / 2))) / BigInt(cambio);
  if (centavos < 1n) throw new Error('El importe convertido es inferior a un centavo.');
  return `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;
}

module.exports = { obtener, convertir };
