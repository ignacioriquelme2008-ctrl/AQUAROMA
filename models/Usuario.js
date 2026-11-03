// Modelo: consultas SQL de usuarios y clientes
const bcrypt = require('bcrypt');
const db = require('../config/db');

// ¿Ya existe ese correo? (revisa usuario y cliente)
exports.correoExiste = async (correo) => {
  const [filas] = await db.query(
    `SELECT 1 FROM usuario WHERE correo = ?
     UNION
     SELECT 1 FROM cliente WHERE correo = ?`,
    [correo, correo]
  );
  return filas.length > 0;
};

// Datos para validar el login.
// HU-006: además trae los roles del usuario en una sola columna, separados por coma
// (por ejemplo "Administrador" o "Cliente"). GROUP_CONCAT junta varias filas en un texto.
exports.buscarPorCorreo = async (correo) => {
  const [filas] = await db.query(
    `SELECT u.id_usuario, u.correo, u.password_hash, u.activo AS usuario_activo,
            c.id_cliente, c.nombre, c.activo AS cliente_activo,
            GROUP_CONCAT(r.nombre ORDER BY r.nombre) AS roles
     FROM usuario u
     LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
     LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
     LEFT JOIN rol r ON r.id_rol = ur.id_rol
     WHERE u.correo = ?
     GROUP BY u.id_usuario, u.correo, u.password_hash, u.activo, c.id_cliente, c.nombre, c.activo`,
    [correo]
  );
  return filas[0] || null;
};

// HU-006: lista de permisos del usuario según sus roles (tablas usuario_rol -> rol_permiso -> permiso).
// Devuelve un arreglo de nombres, por ejemplo ['gestionar_productos', 'ver_panel_admin'].
exports.obtenerPermisos = async (idUsuario) => {
  const [filas] = await db.query(
    `SELECT DISTINCT p.nombre
     FROM usuario_rol ur
     JOIN rol_permiso rp ON rp.id_rol = ur.id_rol
     JOIN permiso p ON p.id_permiso = rp.id_permiso
     WHERE ur.id_usuario = ?
     ORDER BY p.nombre`,
    [idUsuario]
  );
  return filas.map((f) => f.nombre);
};

// Crea cliente + usuario + rol dentro de UNA transacción
exports.crear = async ({ nombre, apellido, telefono, correo, password }) => {
  const hash = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [cli] = await conn.query(
      'INSERT INTO cliente (nombre, apellido, telefono, correo) VALUES (?, ?, ?, ?)',
      [nombre, apellido, telefono, correo]
    );
    const [usr] = await conn.query(
      'INSERT INTO usuario (correo, password_hash, id_cliente) VALUES (?, ?, ?)',
      [correo, hash, cli.insertId]
    );
    await conn.query(
      'INSERT INTO usuario_rol (id_usuario, id_rol) SELECT ?, id_rol FROM rol WHERE nombre = ?',
      [usr.insertId, 'Cliente']
    );

    await conn.commit();           // todo salió bien: se guarda
    return usr.insertId;
  } catch (err) {
    await conn.rollback();         // algo falló: no se guarda nada
    throw err;
  } finally {
    conn.release();                // devuelve la conexión al pool
  }
};

// Guarda la fecha y hora del último acceso
exports.registrarAcceso = async (idUsuario) => {
  await db.query('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [idUsuario]);
};

// HU-007: datos que el cliente ve en su perfil. El correo se lee de "usuario" (es lo que usa
// para iniciar sesión) y solo se muestra: cambiarlo obligaría a tocar dos tablas a la vez.
exports.obtenerPerfil = async (idUsuario) => {
  const [filas] = await db.query(
    `SELECT u.correo, c.nombre, c.apellido, c.telefono, c.fecha_registro
     FROM usuario u
     JOIN cliente c ON c.id_cliente = u.id_cliente
     WHERE u.id_usuario = ?`,
    [idUsuario]
  );
  return filas[0] || null;
};

// HU-007: solo el hash. El controlador lo compara con bcrypt antes de dejar cambiar la contraseña.
exports.obtenerPasswordHash = async (idUsuario) => {
  const [[fila]] = await db.query('SELECT password_hash FROM usuario WHERE id_usuario = ?', [idUsuario]);
  return fila ? fila.password_hash : null;
};

// HU-007: datos personales editables. El correo no se toca a propósito (decisión D1 del plan).
exports.actualizarDatos = async (idCliente, { nombre, apellido, telefono }) => {
  await db.query(
    'UPDATE cliente SET nombre = ?, apellido = ?, telefono = ? WHERE id_cliente = ?',
    [nombre, apellido, telefono, idCliente]
  );
};

// HU-007: guarda la contraseña nueva ya hasheada, igual que en el registro (nunca en texto plano).
exports.cambiarPassword = async (idUsuario, password) => {
  const hash = await bcrypt.hash(password, 10);
  await db.query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [hash, idUsuario]);
};

// HU-005: invalida solicitudes previas y persiste solo el hash del token, nunca el token usable.
exports.crearTokenRecuperacion = async (idUsuario, tokenHash) => {
  await db.query(
    `UPDATE token_recuperacion SET usado_en = NOW()
     WHERE id_usuario = ? AND usado_en IS NULL`,
    [idUsuario]
  );
  await db.query(
    `INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
    [idUsuario, tokenHash]
  );
};

// HU-005: la consulta no distingue entre expirado, utilizado o inexistente.
exports.validarTokenRecuperacion = async (tokenHash) => {
  const [filas] = await db.query(
    `SELECT tr.id_token, tr.id_usuario
     FROM token_recuperacion tr
     JOIN usuario u ON u.id_usuario = tr.id_usuario
     WHERE tr.token_hash = ? AND tr.usado_en IS NULL AND tr.expira_en > NOW()
       AND u.activo = TRUE
     LIMIT 1`,
    [tokenHash]
  );
  return filas[0] || null;
};

// HU-005: consume el token y cambia la clave en una sola transacción (uso único incluso con peticiones simultáneas).
exports.restablecerPassword = async (tokenHash, password) => {
  const hashPassword = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [filas] = await conn.query(
      `SELECT id_token, id_usuario FROM token_recuperacion
       WHERE token_hash = ? AND usado_en IS NULL AND expira_en > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    if (!filas[0]) {
      await conn.rollback();
      return false;
    }
    await conn.query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [hashPassword, filas[0].id_usuario]);
    await conn.query('UPDATE token_recuperacion SET usado_en = NOW() WHERE id_token = ?', [filas[0].id_token]);
    await conn.query(
      `UPDATE token_recuperacion SET usado_en = NOW()
       WHERE id_usuario = ? AND usado_en IS NULL`,
      [filas[0].id_usuario]
    );
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Devuelve solo datos mínimos para el correo de recuperación; no comparte el hash de contraseña.
exports.buscarParaRecuperacion = async (correo) => {
  const [filas] = await db.query(
    `SELECT u.id_usuario, u.correo, u.activo AS usuario_activo, c.activo AS cliente_activo
     FROM usuario u LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
     WHERE u.correo = ? LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
};
