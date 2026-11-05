const multer = require('multer');
const { randomUUID } = require('node:crypto');

function extensionImagen(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      && buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217) return '.jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, fieldSize: 20000, parts: 31 },
  fileFilter(req, file, done) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      req.errorImagen = 'Elige una imagen JPG, PNG o WebP.';
      return done(null, false);
    }
    done(null, true);
  },
}).single('imagenArchivo');

function recibirImagenProducto(req, res, next) {
  recibir(req, res, error => {
    if (error) {
      req.errorImagen = error.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen puede pesar hasta 5 MB.'
        : 'No se pudo recibir la imagen. Selecciona un solo archivo de hasta 5 MB.';
      req.file = null;
    }
    req.body = req.body || {};
    if (req.file) {
      const extension = extensionImagen(req.file.buffer);
      if (!extension) {
        req.errorImagen = 'El archivo no es una imagen JPG, PNG o WebP válida.';
        req.file = null;
      } else {
        req.file.filename = 'producto-' + randomUUID() + extension;
      }
    }
    next();
  });
}

module.exports = { recibirImagenProducto, extensionImagen };
