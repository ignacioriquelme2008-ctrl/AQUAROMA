// HU-005 y HU-033: correo transaccional por SMTP. Los secretos viven solo en .env.
const nodemailer = require('nodemailer');

const configuracion = () => {
  const host = process.env.SMTP_HOST;
  const from = process.env.MAIL_FROM;
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT debe ser un puerto válido.');
  }

  const opciones = {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  };
  if (process.env.SMTP_USER || process.env.SMTP_PASS) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP_USER y SMTP_PASS deben configurarse juntos.');
    opciones.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  }
  return { from, opciones };
};

const enviar = async (mensaje) => {
  const config = configuracion();
  if (!config) throw new Error('SMTP no está configurado.');
  const transporter = nodemailer.createTransport(config.opciones);
  try {
    return await transporter.sendMail({ from: config.from, ...mensaje });
  } finally {
    transporter.close();
  }
};

const baseUrl = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const clp = (monto) => `$${Number(monto).toLocaleString('es-CL')} CLP`;
const escaparHtml = (texto) => String(texto || '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

exports.configurado = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

exports.enviarRecuperacion = async (destinatario, token) => {
  const enlace = `${baseUrl()}/recuperar/${encodeURIComponent(token)}`;
  return enviar({
    to: destinatario,
    subject: 'Recupera tu acceso a AQUAROMA',
    text: `Recibimos una solicitud para cambiar la contraseña de tu cuenta AQUAROMA. Usa este enlace dentro de una hora: ${enlace}\n\nSi no solicitaste el cambio, puedes ignorar este correo.`,
    html: `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta AQUAROMA.</p><p><a href="${enlace}">Crear una contraseña nueva</a></p><p>El enlace vence en una hora y solo se puede usar una vez. Si no solicitaste el cambio, ignora este correo.</p>`,
  });
};

function enviarCorreoPedido(pedido, { subject, parrafos, enlace }) {
  const appUrl = baseUrl();
  const imagen = process.env.MAIL_PEDIDO_IMAGEN_URL?.trim()
    || (appUrl.startsWith('https://') ? `${appUrl}/img/marca/aquaroma-correo.jpg` : '');
  const encabezado = imagen.startsWith('https://')
    ? `<img src="${escaparHtml(imagen)}" alt="AQUAROMA · Agua funcional" width="600" style="display:block;width:100%;max-width:600px;height:auto">`
    : '<p style="font-size:20px;color:#0b2d6b"><strong>AQUAROMA</strong></p>';
  const filas = pedido.items.map((item) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e3edf5">${escaparHtml(item.nombre)} × ${Number(item.cantidad)}</td><td align="right" style="padding:8px 12px;border-bottom:1px solid #e3edf5;white-space:nowrap">${clp(item.subtotal)}</td></tr>`
  ).join('');
  const productos = pedido.items.map(item => `- ${item.nombre} × ${item.cantidad}: ${clp(item.subtotal)}`).join('\n');
  const saludo = `Hola ${pedido.nombre || 'cliente AQUAROMA'},`;
  const total = clp(pedido.total + pedido.costo_envio);
  const resumen = `Productos del pedido #${pedido.id}`;
  const textoEnlace = enlace ? `Ver pedido: ${enlace}` : '';
  const textoTotal = `Total: ${total}`;

  return enviar({
    to: pedido.correo_cuenta || pedido.correo,
    subject,
    text: [saludo, ...parrafos, `${resumen}\n${productos}\n${textoTotal}`, textoEnlace].filter(Boolean).join('\n\n'),
    html: `<div style="max-width:600px;margin:auto;color:#142944;font:16px Arial,sans-serif">
      ${encabezado}
      <p>${escaparHtml(saludo)}</p>
      ${parrafos.map(parrafo => `<p>${escaparHtml(parrafo)}</p>`).join('')}
      <h2 style="font-size:18px">${resumen}</h2>
      <table style="width:100%;border-collapse:collapse"><tbody>${filas}</tbody></table>
      <p><strong>${textoTotal}</strong></p>
      ${enlace ? `<p><a href="${escaparHtml(enlace)}">Ver mi pedido</a></p>` : ''}
    </div>`,
  });
}

exports.enviarConfirmacionPedido = async (pedido) => {
  const direccion = pedido.envio
    ? `${pedido.envio.calle} ${pedido.envio.numero || ''}, ${pedido.envio.comuna}, ${pedido.envio.region}`
    : 'Dirección registrada en tu pedido';
  return enviarCorreoPedido(pedido, {
    subject: `Confirmación de pedido #${pedido.id} | AQUAROMA`,
    parrafos: [`Recibimos tu pedido #${pedido.id}.`, `Dirección de despacho: ${direccion}`],
    enlace: `${baseUrl()}/pedidos/${pedido.id}`,
  });
};

exports.enviarEstadoPedido = async (pedido, estado, despacho) => {
  const mensajes = {
    pagado: 'El pago de tu pedido fue confirmado.',
    preparando: 'Estamos preparando tu pedido.',
    enviado: 'Tu pedido ya va en camino.',
    entregado: 'Tu pedido figura como entregado.',
    cancelado: 'Tu pedido fue cancelado.',
  };
  const parrafos = [
    mensajes[estado],
    estado === 'enviado' && despacho?.transportista && `Transporte: ${despacho.transportista}`,
    estado === 'enviado' && despacho?.tracking && `Seguimiento: ${despacho.tracking}`,
  ].filter(Boolean);
  return enviarCorreoPedido(pedido, {
    subject: `Pedido #${pedido.id} · ${mensajes[estado]} | AQUAROMA`,
    parrafos,
    enlace: `${baseUrl()}/pedidos/${pedido.id}`,
  });
};
