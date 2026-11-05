const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { recibirImagenProducto } = require('../middlewares/imagenProducto');

test('la subida acepta fotos, rechaza archivos falsos y limita el tamaño', async () => {
  const app = express();
  app.post('/', recibirImagenProducto, (req, res) => res.json({
    nombre: req.body.nombre,
    archivo: req.file?.filename || null,
    error: req.errorImagen || null,
  }));
  const server = await new Promise(resolve => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  const subir = async (bytes, tipo, nombre) => {
    const form = new FormData();
    form.set('nombre', 'Producto de prueba');
    form.set('imagenArchivo', new Blob([bytes], { type: tipo }), nombre);
    return (await fetch(`http://127.0.0.1:${server.address().port}`, { method: 'POST', body: form })).json();
  };
  try {
    const foto = readFileSync(path.join(__dirname, '../public/img/productos/uniformes/agua_limon.jpg'));
    const valida = await subir(foto, 'image/jpeg', '../../no-sobrescribir.jpg');
    assert.match(valida.archivo, /^producto-[a-f0-9-]+\.jpg$/);
    assert.equal(valida.nombre, 'Producto de prueba');
    assert.equal(valida.error, null);
    const falsa = await subir(Buffer.from('<script>alert(1)</script>'), 'image/png', 'foto.png');
    assert.equal(falsa.archivo, null);
    assert.ok(falsa.error);
    const svg = await subir(Buffer.from('<svg></svg>'), 'image/svg+xml', 'foto.svg');
    assert.equal(svg.archivo, null);
    assert.ok(svg.error);
    const pesada = await subir(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg', 'grande.jpg');
    assert.equal(pesada.archivo, null);
    assert.match(pesada.error, /5 MB/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
