


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASS_REGEX = /^(?!.*\s)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{8,20}$/;

const TEL_REGEX = /^\+?[0-9]{8,15}$/;

const LARGO_MAX = { nombre: 100, apellido: 100, correo: 120 };



const texto = (valor) => (typeof valor === 'string' ? valor : '');


const LARGO_DIRECCION = { calle: 150, numero: 20, departamento: 50, comuna: 100, region: 100, codigoPostal: 15, referencia: 255 };




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
