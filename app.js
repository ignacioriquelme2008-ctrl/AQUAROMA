// app.js: punto de partida de la aplicación. Configura Express (vistas EJS, archivos estáticos,
// sesión) y conecta las rutas de cada sección. Se ejecuta con "npm run dev" o "npm start".
//
// Cada sección del sitio tiene sus archivos con el mismo nombre en cada carpeta (ver README.md):
//   routes/<seccion>Routes.js -> controllers/<seccion>Controller.js -> views/<seccion>/ -> public/css/<seccion>.css

// Carga las variables del archivo .env para usar configuración como el puerto sin hardcodearlo.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const session = require('express-session');

// Rutas de cada sección del sitio.
const inicioRoutes = require('./routes/inicioRoutes');     // inicio y "Nosotros"
const usuariosRoutes = require('./routes/usuariosRoutes'); // registro, inicio y cierre de sesión
const catalogoRoutes = require('./routes/catalogoRoutes'); // catálogo y ficha de cada producto
const carritoRoutes = require('./routes/carritoRoutes');   // carrito (y carrito guardado en la cuenta, HU-026)
const contactoRoutes = require('./routes/contactoRoutes'); // formulario de contacto (HU-012)
// Rutas del panel de administración (HU-006). Están protegidas por los middlewares de middlewares/auth.js.
const adminRoutes = require('./routes/adminRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes'); // "Mis pedidos" y seguimiento del cliente (HU-032)
const perfilRoutes = require('./routes/perfilRoutes');   // perfil del cliente: datos, contraseña y direcciones (HU-007)

// Middleware que calcula el contador del carrito para el menú (HU-022).
const { cargarCarrito } = require('./middlewares/carrito');

const app = express();

// Configura EJS para renderizar las vistas desde la carpeta views.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Muestra precios en pesos chilenos. Queda disponible en TODAS las vistas.
app.locals.clp = (valor) => '$' + valor.toLocaleString('es-CL') + ' CLP';
// Muestra una fecha de MySQL como "22-10-2026, 21:45". También queda disponible en TODAS las vistas.
app.locals.fechaHora = (fecha) => new Date(fecha).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

// Permite leer formularios y servir archivos estáticos como CSS, JavaScript e imágenes.
app.use(express.urlencoded({ extended: true })); // leer formularios
app.use(express.static(path.join(__dirname, 'public'))); // css, js, img

// Sesión: recuerda quién inició sesión mientras navega
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));

// Deja el usuario disponible en TODAS las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  if (req.session.usuario) res.set('Cache-Control', 'no-store');   // con sesión iniciada, el navegador no guarda copia de las páginas
  next();
});

// Deja el contador del carrito y el aviso de la última acción en TODAS las vistas.
// Va después de la sesión porque lee req.session.usuario y req.session.carrito.
app.use(cargarCarrito);

// Conecta las rutas de cada sección con su dirección.
app.use('/', inicioRoutes);
app.use('/', usuariosRoutes);
app.use('/catalogo', catalogoRoutes);
app.use('/carrito', carritoRoutes);
app.use('/contacto', contactoRoutes);
app.use('/admin', adminRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/perfil', perfilRoutes);

// Si ninguna ruta respondió, la página no existe: se muestra "no encontrado" (404). Va siempre después de las rutas.
app.use((req, res) => res.status(404).render('errores/no-encontrado'));

// Manejador de errores global: Express lo reconoce porque recibe 4 parámetros (err, req, res, next).
// Llegan aquí los errores que los controladores pasan con next(err) y los que produce Express solo
// (por ejemplo, un formulario demasiado grande). Así el visitante nunca ve el detalle técnico del
// error ni las carpetas del servidor.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);          // si ya se empezó a responder, Express lo cierra
  const estado = err.status >= 400 && err.status < 500 ? err.status : 500;   // 4xx = error de la petición, lo demás = 500
  if (estado === 500) console.error(err);          // el detalle completo queda solo en la terminal
  else console.warn(`Petición rechazada (${estado}) en ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(estado).render('errores/error', { estado });
});

// El puerto usa la variable de entorno o un valor por defecto para arrancar el servidor.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aquaroma en http://localhost:${PORT}`));
