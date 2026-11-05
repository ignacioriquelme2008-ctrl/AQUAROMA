require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
(async () => {
  try {
    await db.query(fs.readFileSync(path.join(__dirname, '../database/migraciones/20261104_paypal_checkout.sql'), 'utf8'));
    console.log('Tabla PayPal Checkout disponible.');
  } finally { await db.end(); }
})().catch(err => { console.error('No se pudo aplicar la migración:', err.code || err.message); process.exitCode = 1; });
