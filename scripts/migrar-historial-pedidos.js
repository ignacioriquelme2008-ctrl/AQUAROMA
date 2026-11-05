require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');

async function migrar() {
  try {
    const archivo = path.join(__dirname, '../database/migraciones/20261105_pedido_historial_admin.sql');
    await db.query(fs.readFileSync(archivo, 'utf8'));
    console.log('Historial de pedidos disponible.');
  } finally {
    await db.end();
  }
}

migrar().catch(error => {
  console.error('No se pudo preparar el historial:', error.code || error.message);
  process.exitCode = 1;
});
