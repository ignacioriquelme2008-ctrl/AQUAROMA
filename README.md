# AQUAROMA

Tienda web de aguas funcionales con sabor y aroma. Hecha con **Node.js + Express**, vistas **EJS** y base de datos **MySQL**, siguiendo el patrón **MVC** (Modelo – Vista – Controlador). El sitio está pensado para computador (no está adaptado a celular).

---

## Cómo ejecutarlo

1. Instalar las dependencias (solo la primera vez): `npm install`
2. Crear el archivo `.env` copiando `.env.example` y completar los datos de MySQL.
3. Crear la base: ejecutar `database/aquaroma.sql` completo en MySQL Workbench (File > Open SQL Script > botón del rayo).
   **Ojo:** el script borra la base `aquaroma` y la crea de nuevo.
4. Iniciar la web: `npm run dev` (se reinicia sola al guardar cambios) y abrir http://localhost:3000

Cuentas de prueba (las crea el script SQL):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@aquaroma.cl | Admin.2026 |
| Cliente | benjamin@email.cl | Cliente.2026 |

---

## Cómo está ordenado

Las carpetas siguen MVC. **Dentro de cada carpeta, los archivos se ordenan por sección del sitio y llevan el mismo nombre**, así para cualquier sección se sabe dónde buscar:

```
routes/catalogoRoutes.js  →  controllers/catalogoController.js  →  views/catalogo/  →  public/css/catalogo.css
   (qué URL)                    (qué hacer)                           (qué mostrar)       (cómo se ve)
```

```
aquaroma/
├── app.js                 Punto de partida: configura Express y conecta las rutas de cada sección
├── package.json           Dependencias y comandos (npm run dev / npm start)
├── .env.example           Modelo del archivo .env (el .env real NO se comparte: tiene las claves)
├── config/
│   └── db.js              Conexión a MySQL (pool de conexiones)
├── routes/                QUÉ URL atiende cada sección
├── controllers/           QUÉ HACER con cada petición: valida, pide datos al modelo y elige la vista
├── models/                Consultas SQL, agrupadas por dato: Usuario, Producto, Carrito
├── middlewares/
│   └── auth.js            Guardias de acceso: sesión iniciada, solo administrador, permisos (HU-006)
├── utils/
│   └── validaciones.js    Reglas compartidas: correo, contraseña, teléfono, largos máximos
├── views/                 QUÉ MOSTRAR (páginas EJS), una carpeta por sección
│   └── partials/          Piezas que usan todas las páginas: head.ejs (título y CSS) y navbar.ejs (menú)
├── public/                Archivos que se envían tal cual al navegador
│   ├── css/               base.css (común a todo) + una hoja por sección
│   ├── js/                JavaScript que corre en el navegador
│   └── img/
│       ├── marca/         Logo y fondo de la portada
│       └── productos/     Una foto por producto (el nombre del archivo está en la columna producto.imagen)
├── database/
│   └── aquaroma.sql       Base completa: tablas, triggers, procedimientos, vistas y datos de prueba
└── docs/
    ├── CAMBIOS.txt                  Historial de cambios del código (qué se hizo, por qué y cómo se probó)
    └── CAMBIOS_BASE_DE_DATOS.txt    Historial de cambios de la base de datos
```

---

## Mapa por sección

| Sección | Historias | URL | Rutas | Controlador | Modelo | Vistas | CSS | JS (navegador) |
|---|---|---|---|---|---|---|---|---|
| **Inicio** | HU-008, HU-010 | `/`, `/nosotros` | `inicioRoutes.js` | `inicioController.js` | `Producto.js` (destacados) | `views/inicio/` | `inicio.css` | — |
| **Menú** | HU-009 | todas | — | — | — | `views/partials/navbar.ejs` | `base.css` | — |
| **Usuarios** | HU-001, HU-002, HU-003, HU-004 | `/registro`, `/login`, `/logout` | `usuariosRoutes.js` | `usuariosController.js` | `Usuario.js` | `views/usuarios/` | `usuarios.css` | `registro.js` |
| **Roles y permisos** | HU-006 | — | — | — | `Usuario.js` (permisos) | `views/errores/acceso-denegado.ejs` | — | — |
| **Catálogo** | HU-013 a HU-017 | `/catalogo`, `/catalogo/:id` | `catalogoRoutes.js` | `catalogoController.js` | `Producto.js` | `views/catalogo/` | `catalogo.css`, `producto.css` | `catalogo-filtros.js` |
| **Carrito** | HU-022 a HU-026 | `/carrito`, `/carrito/api` | `carritoRoutes.js` | `carritoController.js` | `Carrito.js` | `views/carrito/` | `carrito.css` | `carrito.js`, `carrito-pagina.js` |
| **Administración** | HU-006 (después HU-035 a HU-040) | `/admin` | `adminRoutes.js` | `adminController.js` | — | `views/admin/panel.ejs` | `admin.css` | — |
| **Admin: productos** | HU-036 (después HU-037) | `/admin/productos`, `/admin/productos/nuevo` | `adminRoutes.js` (permiso `gestionar_productos`) | `adminProductosController.js` | `Producto.js` (parte "ADMINISTRACIÓN") | `views/admin/productos.ejs`, `views/admin/producto-nuevo.ejs` | `admin.css` | — |
| **Errores** | — | cualquier URL que no existe, o un error del servidor | `app.js` (al final: 404 y manejador de errores) | — | — | `views/errores/` (`no-encontrado`, `error`, `acceso-denegado`) | `base.css` | — |

Diseño para computador (HU-011): está repartido en todas las hojas CSS.

### Archivos de JavaScript del navegador

- `public/js/carrito.js` — se carga en **todas** las páginas desde el menú. Guarda el carrito en el navegador y, si hay un cliente con sesión, en su cuenta (HU-026). Conecta los botones "Agregar al carrito".
- `public/js/carrito-pagina.js` — solo en `/carrito`: dibuja los productos, cantidades, eliminar y el resumen.
- `public/js/catalogo-filtros.js` — solo en `/catalogo`: filtros por aroma y tipo de agua.
- `public/js/registro.js` — solo en `/registro`: revisa la contraseña mientras se escribe.

---

## Cómo agregar una sección nueva

Ejemplo para pedidos (HU-028 a HU-034). Se repite el mismo patrón de las demás secciones:

1. `routes/pedidosRoutes.js` — las URL (por ejemplo `router.get('/', ...)`).
2. `controllers/pedidosController.js` — qué hacer en cada URL.
3. `models/Pedido.js` — las consultas SQL.
4. `views/pedidos/` — las páginas. En el `<head>` de cada una:
   `<%- include('../partials/head', { titulo: 'Mis pedidos | AQUAROMA', estilos: ['pedidos'] }) %>`
5. `public/css/pedidos.css` — los estilos de la sección (los comunes ya vienen en `base.css`).
6. Conectarla en `app.js`: `app.use('/pedidos', require('./routes/pedidosRoutes'));`

Para proteger una ruta se usan los guardias de `middlewares/auth.js`: `requiereSesion`, `soloAdmin` o `requierePermiso('nombre_del_permiso')`.

**Importante para HU-028 (confirmar pedido):** el carrito de cada cliente ya es un pedido en estado `'carrito'`. Al confirmar, hay que cambiar el estado de **ese** pedido a `'confirmado'` (no crear otro); así el carrito queda vacío solo. Detalle en `docs/CAMBIOS.txt`, punto 11.
