// Reglas de validación compartidas por el registro, el login y la recuperación de contraseña.
// Se revisan en el servidor porque las validaciones del navegador se pueden saltar.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 8 a 20 caracteres, con mayúscula, minúscula, número y carácter especial, sin espacios.
const PASS_REGEX = /^(?!.*\s)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{8,20}$/;
// Se aplica al teléfono SIN espacios: un "+" opcional y de 8 a 15 dígitos.
const TEL_REGEX = /^\+?[0-9]{8,15}$/;
// Largo máximo de cada campo: debe coincidir con las columnas de la base (cliente.nombre VARCHAR(100), etc.).
const LARGO_MAX = { nombre: 100, apellido: 100, correo: 120 };

// Devuelve siempre un texto. Si llega una lista (correo[]=a) o un objeto, se trata como vacío.
// Así .trim() nunca falla y el servidor no se cae.
const texto = (valor) => (typeof valor === 'string' ? valor : '');

// HU-007 / HU-029: largo máximo de cada campo de una dirección, igual que las columnas de la base.
const LARGO_DIRECCION = { calle: 150, numero: 20, departamento: 50, comuna: 100, region: 100, codigoPostal: 15, referencia: 255 };

// HU-007 / HU-029: revisa una dirección escrita por el cliente, venga del carrito o del perfil.
// Devuelve { datos } si está completa o { error } con el primer problema encontrado.
// Está aquí (y no en un controlador) para que el carrito y el perfil validen exactamente igual.
function leerDireccionNueva(fuente) {
  const d = {
    calle: texto(fuente.calle).trim(),
    numero: texto(fuente.numero).trim(),
    departamento: texto(fuente.departamento).trim(),
    comuna: texto(fuente.comuna).trim(),
    region: texto(fuente.region).trim(),
    codigoPostal: texto(fuente.codigoPostal).trim(),
    referencia: texto(fuente.referencia).trim(),
  };
  if (!d.calle) return { error: 'Ingresa la calle de la dirección de entrega.' };
  if (!d.comuna) return { error: 'Ingresa la comuna de la dirección de entrega.' };
  if (!d.region) return { error: 'Ingresa la región de la dirección de entrega.' };
  for (const [campo, largo] of Object.entries(LARGO_DIRECCION)) {
    if (d[campo] && d[campo].length > largo) {
      return { error: `Uno de los datos de la dirección es demasiado largo (máximo ${largo} caracteres).` };
    }
  }
  return { datos: d };
}

module.exports = { EMAIL_REGEX, PASS_REGEX, TEL_REGEX, LARGO_MAX, LARGO_DIRECCION, leerDireccionNueva, texto };
