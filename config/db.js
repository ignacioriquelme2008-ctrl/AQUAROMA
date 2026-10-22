//Lo que hace cada parte, para explicarlo:

//Los valores de conexión salen de process.env: app.js ya cargó el archivo .env antes de que se use este archivo.
//mysql2/promise es la versión de la librería que permite usar await.
//createPool abre un grupo de conexiones reutilizables, en vez de abrir una nueva por cada consulta.
//module.exports deja el pool disponible para que los modelos lo importen con require('../config/db').


// Conexión a MySQL (pool = varias conexiones reutilizables)
const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});