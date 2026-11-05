const { Store } = require('express-session');
const { createHash } = require('node:crypto');

const DURACION_SESION = 7 * 24 * 60 * 60 * 1000;

// Guarda las sesiones fuera del proceso de Node para conservarlas al reiniciar.
// Solo se guarda el hash del identificador; la cookie sigue siendo HttpOnly.
class MysqlSessionStore extends Store {
  constructor(db) {
    super();
    this.db = db;
    this.preparacion = null;
    this.ultimaLimpieza = 0;
  }

  async preparar() {
    if (!this.preparacion) {
      this.preparacion = this.db.query(`CREATE TABLE IF NOT EXISTS sesion_web (
        id_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        datos MEDIUMTEXT NOT NULL,
        vence DATETIME(3) NOT NULL,
        INDEX sesion_web_vence (vence)
      ) ENGINE=InnoDB`).catch(err => {
        this.preparacion = null;
        throw err;
      });
    }
    await this.preparacion;
  }

  clave(sid) {
    return createHash('sha256').update(sid).digest('hex');
  }

  vencimiento(sesion) {
    return sesion.cookie?.expires
      ? new Date(sesion.cookie.expires)
      : new Date(Date.now() + DURACION_SESION);
  }

  get(sid, callback) {
    this.preparar().then(async () => {
      const [filas] = await this.db.query(
        'SELECT datos FROM sesion_web WHERE id_hash = ? AND vence > NOW(3)',
        [this.clave(sid)]
      );
      return filas.length ? JSON.parse(filas[0].datos) : null;
    }).then(datos => callback(null, datos), callback);
  }

  set(sid, sesion, callback = () => {}) {
    this.preparar().then(async () => {
      await this.db.query(
        `INSERT INTO sesion_web (id_hash, datos, vence) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE datos = VALUES(datos), vence = VALUES(vence)`,
        [this.clave(sid), JSON.stringify(sesion), this.vencimiento(sesion)]
      );
      // Limpieza ocasional, sin tareas en segundo plano ni temporizadores.
      if (Date.now() - this.ultimaLimpieza > 60 * 60 * 1000) {
        this.ultimaLimpieza = Date.now();
        void this.db.query('DELETE FROM sesion_web WHERE vence <= NOW(3)').catch(() => {
          this.ultimaLimpieza = 0;
        });
      }
    }).then(() => callback(null), callback);
  }

  touch(sid, sesion, callback = () => {}) {
    this.preparar().then(() => this.db.query(
      'UPDATE sesion_web SET vence = ? WHERE id_hash = ?',
      [this.vencimiento(sesion), this.clave(sid)]
    )).then(() => callback(null), callback);
  }

  destroy(sid, callback = () => {}) {
    this.preparar().then(() => this.db.query(
      'DELETE FROM sesion_web WHERE id_hash = ?', [this.clave(sid)]
    )).then(() => callback(null), callback);
  }
}

module.exports = { MysqlSessionStore, DURACION_SESION };
