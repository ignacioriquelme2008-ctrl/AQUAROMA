-- HU-005 y HU-034. Ejecutar una vez en bases existentes antes de publicar estas historias.
-- En instalaciones nuevas, ambas tablas ya se crean desde database/aquaroma.sql.
CREATE TABLE IF NOT EXISTS token_recuperacion (
    id_token INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en DATETIME NOT NULL,
    usado_en DATETIME NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    INDEX idx_token_recuperacion_usuario (id_usuario, expira_en)
);

CREATE TABLE IF NOT EXISTS solicitud_reembolso (
    id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
    id_pago INT NOT NULL UNIQUE,
    id_usuario_solicita INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    motivo TEXT NOT NULL,
    estado ENUM('pendiente','procesada','rechazada') NOT NULL DEFAULT 'pendiente',
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pago) REFERENCES pago(id_pago),
    FOREIGN KEY (id_usuario_solicita) REFERENCES usuario(id_usuario)
);
