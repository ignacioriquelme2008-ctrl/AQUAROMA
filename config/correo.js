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

// Correo transaccional: nunca incluye marketing ni promociones sin consentimiento explícito.
exports.enviarConfirmacionPedido = async (pedido) => {
  const nombre = escaparHtml(`${pedido.nombre || ''} ${pedido.apellido || ''}`.trim() || 'cliente AQUAROMA');
  const filas = pedido.items.map((item) =>
    `<tr><td>${escaparHtml(item.nombre)} × ${Number(item.cantidad)}</td><td>${clp(item.subtotal)}</td></tr>`
  ).join('');
  const direccion = pedido.envio
    ? `${pedido.envio.calle} ${pedido.envio.numero || ''}, ${pedido.envio.comuna}, ${pedido.envio.region}`
    : 'Dirección registrada en tu pedido';
  const direccionHtml = escaparHtml(direccion);
  const textoItems = pedido.items.map((item) => `- ${item.nombre} × ${item.cantidad}: ${clp(item.subtotal)}`).join('\n');
  const texto = [
    `Hola ${pedido.nombre || 'cliente AQUAROMA'}, recibimos tu pedido #${pedido.id}.`,
    '', textoItems,
    '', `Total: ${clp(pedido.total + pedido.costo_envio)}`,
    `Dirección de despacho: ${direccion}`,
    '', 'Gracias por elegir AQUAROMA.',
  ].join('\n');
  return enviar({
    to: pedido.correo,
    subject: `Confirmación de pedido #${pedido.id} | AQUAROMA`,
    text: texto,
    html: `<p>Hola ${nombre}, recibimos tu pedido <strong>#${pedido.id}</strong>.</p><table><tbody>${filas}</tbody></table><p>Total: <strong>${clp(pedido.total + pedido.costo_envio)}</strong></p><p>Dirección de despacho: ${direccionHtml}</p><p>Gracias por elegir AQUAROMA.</p>`,
  });
};
