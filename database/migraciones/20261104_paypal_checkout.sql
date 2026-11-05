-- Cotización congelada y referencias de la demo Sandbox vinculadas a un pago real del sistema.
CREATE TABLE IF NOT EXISTS paypal_checkout (
  id_pago INT PRIMARY KEY,
  monto_usd DECIMAL(12,2) NOT NULL,
  tasa_clp DECIMAL(18,8) NOT NULL,
  fecha_tasa DATETIME NOT NULL,
  order_id VARCHAR(64) NULL UNIQUE,
  capture_id VARCHAR(64) NULL UNIQUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_pago) REFERENCES pago(id_pago)
);
