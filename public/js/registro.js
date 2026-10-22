// Formulario de registro (views/usuarios/registro.ejs, HU-002).
// Validación en el navegador: da ayuda inmediata. El servidor vuelve a validar todo igual
// (controllers/usuariosController.js), porque lo del navegador se puede saltar.
const form = document.getElementById('registro'),
  password = document.getElementById('password'),
  confirmar = document.getElementById('confirmar'),
  aviso = document.getElementById('avisoConfirmar');
// El largo permitido lo escribe el servidor en el formulario (data-pass-min y data-pass-max).
const PASS_MIN = Number(form.dataset.passMin),
  PASS_MAX = Number(form.dataset.passMax);

// Reglas de la contraseña (deben coincidir con PASS_REGEX de utils/validaciones.js).
const reglas = {
  largo: (p) => p.length >= PASS_MIN && p.length <= PASS_MAX,
  mayuscula: (p) => /[A-Z]/.test(p),
  minuscula: (p) => /[a-z]/.test(p),
  numero: (p) => /[0-9]/.test(p),
  especial: (p) => /[^A-Za-z0-9\s]/.test(p),
};

// Marca en verde cada requisito que se cumple y muestra el aviso si las contraseñas no coinciden.
function revisar() {
  let todas = true;
  document.querySelectorAll('[data-regla]').forEach((li) => {
    const ok = reglas[li.dataset.regla](password.value);
    li.classList.toggle('ok', ok);
    if (!ok) todas = false;
  });
  const iguales = password.value === confirmar.value;
  aviso.hidden = iguales || !confirmar.value;
  return todas && iguales;
}

password.addEventListener('input', revisar);
confirmar.addEventListener('input', revisar);

// No se envía el formulario si falta algún campo o la contraseña no cumple.
form.addEventListener('submit', (e) => {
  const contrasenaOk = revisar();
  if (!form.checkValidity() || !contrasenaOk) {
    e.preventDefault();
    form.reportValidity();
    if (!contrasenaOk) password.focus();
  }
});
