const { existsSync } = require('node:fs');
const path = require('node:path');

// Serie uniforme de las once imágenes actuales. Conserva las originales y
// permite seguir mostrando normalmente productos que se agreguen después.
const imagenesUniformes = new Set([
  'agua_limon.png', 'agua_menta.jpg', 'agua_frutilla.png', 'agua_pepino.png',
  'agua_durazno.png', 'agua_arandano.jpg', 'agua_mango.png', 'agua_frutos_rojos.png',
  'hibisco_y_rosa.jpg', 'limon_y_menta.jpg', 'pepino_y_limon.jpg',
]);

function imagenProducto(archivo) {
  if (imagenesUniformes.has(archivo)) {
    const nuevoArchivo = archivo.replace(/\.[^.]+$/, '.jpg');
    if (existsSync(path.join(__dirname, '../public/img/productos/uniformes', nuevoArchivo))) {
      return '/img/productos/uniformes/' + nuevoArchivo;
    }
  }
  return '/img/productos/' + encodeURIComponent(archivo || '');
}

module.exports = { imagenProducto };
