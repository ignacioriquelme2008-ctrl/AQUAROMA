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

module.exports = { EMAIL_REGEX, PASS_REGEX, TEL_REGEX, LARGO_MAX, texto };
