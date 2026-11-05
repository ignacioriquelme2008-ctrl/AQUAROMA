const API = 'https://api-m.sandbox.paypal.com';

function configuracionPublica() {
  const enabled = process.env.PAYPAL_ENV === 'sandbox' && process.env.NODE_ENV !== 'production'
    && Boolean(process.env.PAYPAL_CLIENT_ID) && Boolean(process.env.PAYPAL_CLIENT_SECRET);
  return { enabled, clientId: enabled ? process.env.PAYPAL_CLIENT_ID : null };
}

async function request(path, method = 'GET', body, requestId) {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const auth = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials', signal: AbortSignal.timeout(10000),
  });
  const token = await auth.json();
  if (!auth.ok || !token.access_token) throw new Error('PayPal no aceptó las credenciales Sandbox.');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('PayPal no pudo completar la operación. Puedes volver a intentar el pago.');
  return data;
}

module.exports = { configuracionPublica, request };
