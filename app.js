






require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MysqlSessionStore, DURACION_SESION } = require('./config/sessionStore');
const { imagenProducto } = require('./utils/imagenesProductos');


const inicioRoutes = require('./routes/inicioRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');
const carritoRoutes = require('./routes/carritoRoutes');
const contactoRoutes = require('./routes/contactoRoutes');

const adminRoutes = require('./routes/adminRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const paypalSandboxRoutes = require('./routes/paypalSandboxRoutes');


const { cargarCarrito } = require('./middlewares/carrito');

const app = express();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.imagenProducto = imagenProducto;


app.locals.clp = (valor) => '$' + valor.toLocaleString('es-CL') + ' CLP';

app.locals.fechaHora = (fecha) => new Date(fecha).toLocaleString('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});


app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
  store: new MysqlSessionStore(require('./config/db')),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION,
  },
}));


app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  if (req.session.usuario) res.set('Cache-Control', 'no-store');
  next();
});



app.use(cargarCarrito);


app.use('/', inicioRoutes);
app.use('/', usuariosRoutes);
app.use('/catalogo', catalogoRoutes);
app.use('/carrito', carritoRoutes);
app.use('/contacto', contactoRoutes);
app.use('/admin', adminRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/perfil', perfilRoutes);
app.use('/', paypalSandboxRoutes);


app.use((req, res) => res.status(404).render('errores/no-encontrado'));





app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const estado = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (estado === 500) console.error(err);
  else console.warn(`Petición rechazada (${estado}) en ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(estado).render('errores/error', { estado });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aquaroma en http://localhost:${PORT}`));
