-- ============================================================
-- BASE DE DATOS FINAL Y NORMALIZADA - AQUAROMA
-- Versión Corregida con Trazabilidad, Triggers y Procedimientos con ROLLBACK
-- ============================================================ --
DROP DATABASE IF EXISTS aquaroma;
CREATE DATABASE aquaroma
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE aquaroma;

-- ============================================================
-- 1. UBICACIÓN Y DIRECCIÓN (3FN)
-- ============================================================
CREATE TABLE ubicacion (
    id_ubicacion INT AUTO_INCREMENT PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    provincia VARCHAR(100),
    comuna VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL DEFAULT 'Chile',
    CONSTRAINT uk_ubicacion UNIQUE (region, provincia, comuna, pais)
);

CREATE TABLE direccion (
    id_direccion INT AUTO_INCREMENT PRIMARY KEY,
    id_ubicacion INT NOT NULL,
    calle VARCHAR(150) NOT NULL,
    numero VARCHAR(20),
    pasaje VARCHAR(100),
    departamento VARCHAR(50),
    codigo_postal VARCHAR(15),
    referencia VARCHAR(255),
    FOREIGN KEY (id_ubicacion) REFERENCES ubicacion(id_ubicacion)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- 2. UNIDADES DE MEDIDA
-- ============================================================
CREATE TABLE unidad_medida (
    id_unidad INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    familia ENUM('volumen','masa','unidad') NOT NULL DEFAULT 'volumen',
    factor_a_base DECIMAL(12,6) NOT NULL DEFAULT 1.000000,
    CONSTRAINT chk_factor_positivo CHECK (factor_a_base > 0)
);

-- ============================================================
-- 3. INSUMOS Y PROVEEDORES
-- ============================================================
CREATE TABLE insumo (
    id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    id_unidad INT NOT NULL,
    tipo_insumo ENUM('ingrediente','envase','etiqueta','otro') NOT NULL DEFAULT 'ingrediente',
    stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (id_unidad) REFERENCES unidad_medida(id_unidad) ON DELETE RESTRICT
);

CREATE TABLE proveedor (
    id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(120),
    id_direccion INT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_direccion) REFERENCES direccion(id_direccion) ON DELETE SET NULL
);

CREATE TABLE proveedor_insumo (
    id_proveedor INT NOT NULL,
    id_insumo INT NOT NULL,
    precio_ref DECIMAL(12,4) CHECK (precio_ref >= 0),
    codigo_proveedor VARCHAR(50),
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_proveedor, id_insumo),
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo) ON DELETE RESTRICT
);

-- ============================================================
-- 4. COMPONENTES Y PERSONALIZACIÓN
-- ============================================================
CREATE TABLE componente (
    id_componente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo ENUM('aroma','sabor','mixto') NOT NULL DEFAULT 'aroma',
    unidad_dosificacion VARCHAR(30) NOT NULL DEFAULT 'dosis',
    recargo_precio DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (recargo_precio >= 0),
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE componente_insumo (
    id_componente INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad_insumo_por_dosis DECIMAL(12,4) NOT NULL CHECK (cantidad_insumo_por_dosis > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_componente, id_insumo),
    FOREIGN KEY (id_componente) REFERENCES componente(id_componente) ON DELETE RESTRICT,
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo) ON DELETE RESTRICT
);

-- ============================================================
-- 5. PRODUCTOS Y FORMULACIONES
-- ============================================================
CREATE TABLE tipo_agua (
    id_tipo_agua INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE presentacion (
    id_presentacion INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    volumen_ml INT NOT NULL CHECK (volumen_ml > 0),
    tipo_envase VARCHAR(50),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_presentacion UNIQUE (nombre, volumen_ml)
);

CREATE TABLE categoria (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE producto (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    id_tipo_agua INT NOT NULL,
    id_presentacion INT NOT NULL,
    id_categoria INT NULL,
    precio_base DECIMAL(10,2) NOT NULL CHECK (precio_base >= 0),
    es_personalizable BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion TEXT,
    -- Texto completo que se muestra en la ficha del producto (HU-016). "descripcion" es la etiqueta corta del catálogo.
    descripcion_larga TEXT NULL,
    imagen VARCHAR(100) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tipo_agua) REFERENCES tipo_agua(id_tipo_agua),
    FOREIGN KEY (id_presentacion) REFERENCES presentacion(id_presentacion),
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

CREATE TABLE formulacion (
    id_formulacion INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto) ON DELETE RESTRICT,
    CONSTRAINT uk_formulacion UNIQUE (id_producto, version)
);

CREATE TABLE formulacion_insumo (
    id_formulacion INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad DECIMAL(12,4) NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (id_formulacion, id_insumo),
    FOREIGN KEY (id_formulacion) REFERENCES formulacion(id_formulacion) ON DELETE CASCADE,
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo) ON DELETE RESTRICT
);

-- ============================================================
-- 6. SUCURSALES, INVENTARIO Y LOTES
-- ============================================================
CREATE TABLE sucursal (
    id_sucursal INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    id_direccion INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (id_direccion) REFERENCES direccion(id_direccion)
);

CREATE TABLE inventario (
    id_inventario INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal INT NOT NULL,
    id_insumo INT NULL,
    id_producto INT NULL,
    cantidad DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    -- Umbral de stock bajo de ese producto en esa sucursal (HU-039). Con cantidad <= stock_minimo,
    -- el panel lo marca como alerta. El administrador lo cambia en /admin/stock.
    stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    CONSTRAINT uk_inventario_insumo UNIQUE (id_sucursal, id_insumo),
    CONSTRAINT uk_inventario_producto UNIQUE (id_sucursal, id_producto)
);

-- ============================================================
-- 7. CLIENTES, USUARIOS, ROLES Y PERMISOS
-- ============================================================
CREATE TABLE cliente (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    telefono VARCHAR(20),
    correo VARCHAR(120) UNIQUE NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cliente_direccion (
    id_cliente INT NOT NULL,
    id_direccion INT NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    alias VARCHAR(50),
    PRIMARY KEY (id_cliente, id_direccion),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    FOREIGN KEY (id_direccion) REFERENCES direccion(id_direccion) ON DELETE RESTRICT
);

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_cliente INT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso DATETIME NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE SET NULL
);

-- HU-005: tokens de recuperación guardados como hash, de un solo uso y con vencimiento.
CREATE TABLE token_recuperacion (
    id_token INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en DATETIME NOT NULL,
    usado_en DATETIME NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    INDEX idx_token_recuperacion_usuario (id_usuario, expira_en)
);

CREATE TABLE rol (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE permiso (
    id_permiso INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE rol_permiso (
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol) ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES permiso(id_permiso) ON DELETE CASCADE
);

CREATE TABLE usuario_rol (
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    PRIMARY KEY (id_usuario, id_rol),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol) ON DELETE RESTRICT
);

-- ============================================================
-- 8. COMPRAS Y LOTES
-- ============================================================
CREATE TABLE compra (
    id_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_usuario_registro INT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    estado ENUM('borrador','recibida','anulada') NOT NULL DEFAULT 'borrador',
    observacion TEXT,
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor),
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
);

CREATE TABLE detalle_compra (
    id_detalle_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_compra INT NOT NULL,
    id_insumo INT NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,4) NOT NULL CHECK (precio_unitario >= 0),
    subtotal DECIMAL(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    FOREIGN KEY (id_compra) REFERENCES compra(id_compra) ON DELETE CASCADE,
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo) ON DELETE RESTRICT
);

CREATE TABLE lote_insumo (
    id_lote INT AUTO_INCREMENT PRIMARY KEY,
    id_insumo INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_compra INT NULL,
    codigo_lote VARCHAR(50) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    cantidad_inicial DECIMAL(12,3) NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_actual DECIMAL(12,3) NOT NULL CHECK (cantidad_actual >= 0),
    estado ENUM('disponible','vencido','agotado') NOT NULL DEFAULT 'disponible',
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo),
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_compra) REFERENCES compra(id_compra),
    CONSTRAINT uk_lote_codigo UNIQUE (id_insumo, id_sucursal, codigo_lote)
);

-- ============================================================
-- 9. MOVIMIENTOS Y TRANSFERENCIAS
-- ============================================================
CREATE TABLE transferencia_inventario (
    id_transferencia INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal_origen INT NOT NULL,
    id_sucursal_destino INT NOT NULL,
    id_usuario_envia INT NOT NULL,
    id_usuario_recibe INT NULL,
    fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_recepcion DATETIME NULL,
    estado ENUM('en_transito','completada','cancelada') NOT NULL DEFAULT 'en_transito',
    observacion TEXT,
    FOREIGN KEY (id_sucursal_origen) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_sucursal_destino) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_usuario_envia) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_usuario_recibe) REFERENCES usuario(id_usuario)
);

CREATE TABLE movimiento_inventario (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal INT NOT NULL,
    id_insumo INT NULL,
    id_producto INT NULL,
    id_lote INT NULL,
    tipo ENUM(
        'entrada_compra',
        'salida_produccion',
        'entrada_produccion',
        'salida_venta',
        'entrada_devolucion',
        'ajuste',
        'merma',
        'transferencia_salida',
        'transferencia_entrada'
    ) NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    tipo_origen ENUM('compra','orden_produccion','pedido','transferencia','ajuste_manual') NOT NULL,
    id_origen_referencia INT NULL,
    id_usuario INT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_insumo) REFERENCES insumo(id_insumo),
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_lote) REFERENCES lote_insumo(id_lote),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- ============================================================
-- 10. CONFIGURACIÓN DE BEBIDA Y PEDIDOS
-- ============================================================
CREATE TABLE configuracion_bebida (
    id_configuracion INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    id_cliente INT NULL,
    nombre_display VARCHAR(150),
    precio_final DECIMAL(10,2) NOT NULL CHECK (precio_final >= 0),
    es_plantilla_global BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);

CREATE TABLE configuracion_componente (
    id_configuracion INT NOT NULL,
    id_componente INT NOT NULL,
    cantidad DECIMAL(8,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0 AND cantidad <= 5),
    PRIMARY KEY (id_configuracion, id_componente),
    FOREIGN KEY (id_configuracion) REFERENCES configuracion_bebida(id_configuracion) ON DELETE CASCADE,
    FOREIGN KEY (id_componente) REFERENCES componente(id_componente) ON DELETE RESTRICT
);

-- HU-021: configuraciones favoritas del cliente.
-- La preparación en sí NO se duplica: ya vive en configuracion_bebida + configuracion_componente
-- (la misma fila que crea el carrito al elegir aroma e intensidad). Aquí solo se guarda el nombre
-- con el que el cliente la bautizó y a quién pertenece.
-- UNIQUE (id_cliente, alias): un cliente no puede tener dos favoritas con el mismo nombre.
CREATE TABLE configuracion_favorita (
    id_favorita INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_configuracion INT NOT NULL,
    alias VARCHAR(60) NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_favorita UNIQUE (id_cliente, alias),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_configuracion) REFERENCES configuracion_bebida(id_configuracion) ON DELETE CASCADE
);

CREATE TABLE pedido (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_sucursal INT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM(
        'carrito',
        'confirmado',
        'pagado',
        'preparando',
        'enviado',
        'entregado',
        'cancelado'
    ) NOT NULL DEFAULT 'carrito',
    total DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
    observacion TEXT,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal)
);

CREATE TABLE detalle_pedido (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_configuracion INT NOT NULL,
    id_formulacion_aplicada INT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal DECIMAL(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE RESTRICT,
    FOREIGN KEY (id_configuracion) REFERENCES configuracion_bebida(id_configuracion) ON DELETE RESTRICT,
    FOREIGN KEY (id_formulacion_aplicada) REFERENCES formulacion(id_formulacion) ON DELETE SET NULL
);

-- ============================================================
-- 11. PRODUCCIÓN
-- ============================================================
CREATE TABLE orden_produccion (
    id_orden INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NULL,
    id_sucursal INT NOT NULL,
    id_usuario_responsable INT NULL,
    fecha_orden DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio DATETIME NULL,
    fecha_fin DATETIME NULL,
    estado ENUM('pendiente','en_proceso','completada','cancelada') NOT NULL DEFAULT 'pendiente',
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
    FOREIGN KEY (id_usuario_responsable) REFERENCES usuario(id_usuario)
);

CREATE TABLE detalle_orden_produccion (
    id_detalle_orden INT AUTO_INCREMENT PRIMARY KEY,
    id_orden INT NOT NULL,
    id_producto INT NOT NULL,
    id_configuracion INT NULL,
    cantidad_a_producir INT NOT NULL CHECK (cantidad_a_producir > 0),
    FOREIGN KEY (id_orden) REFERENCES orden_produccion(id_orden) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto),
    FOREIGN KEY (id_configuracion) REFERENCES configuracion_bebida(id_configuracion)
);

-- ============================================================
-- 12. PAGOS, REEMBOLSOS Y ENVÍO
-- ============================================================
CREATE TABLE metodo_pago (
    id_metodo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pago (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_metodo INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    estado ENUM('pendiente','aprobado','rechazado','reembolsado_parcial','reembolsado_total') NOT NULL DEFAULT 'pendiente',
    referencia_externa VARCHAR(100) UNIQUE,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_pago DATETIME NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_metodo) REFERENCES metodo_pago(id_metodo)
);

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


CREATE TABLE reembolso (
    id_reembolso INT AUTO_INCREMENT PRIMARY KEY,
    id_pago INT NOT NULL,
    id_usuario_autoriza INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    motivo TEXT,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pago) REFERENCES pago(id_pago),
    FOREIGN KEY (id_usuario_autoriza) REFERENCES usuario(id_usuario)
);

-- HU-034: registra una solicitud de devolución sin marcarla como reembolso ejecutado.
-- El procesamiento real queda pendiente de la integración de pagos (priorizada al final).
CREATE TABLE solicitud_reembolso (
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

CREATE TABLE envio (
    id_envio INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL UNIQUE,
    calle VARCHAR(150) NOT NULL,
    numero VARCHAR(20),
    pasaje VARCHAR(100),
    departamento VARCHAR(50),
    comuna VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(15),
    referencia VARCHAR(255),
    pais VARCHAR(100) NOT NULL DEFAULT 'Chile',
    transportista VARCHAR(100),
    tracking VARCHAR(100),
    fecha_envio DATETIME NULL,
    fecha_entrega DATETIME NULL,
    estado ENUM('preparando','en_camino','entregado','devuelto','cancelado') NOT NULL DEFAULT 'preparando',
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    CONSTRAINT chk_fechas_envio CHECK (
        fecha_entrega IS NULL OR fecha_envio IS NULL OR fecha_entrega >= fecha_envio
    )
);

-- Mensajes del formulario de contacto. Los guarda la HU-012 (formulario) y el panel de
-- administración muestra los que no se han leído (HU-035).
CREATE TABLE mensaje_contacto (
    id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(120) NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. TRIGGERS DE INTEGRIDAD Y VALIDACIÓN
-- ============================================================
DELIMITER //

-- Validar exclusividad Insumo o Producto (INSERT)
CREATE TRIGGER trg_inventario_chk_bi
BEFORE INSERT ON inventario
FOR EACH ROW
BEGIN
    IF (NEW.id_insumo IS NULL AND NEW.id_producto IS NULL)
       OR (NEW.id_insumo IS NOT NULL AND NEW.id_producto IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Debe registrar exactamente un insumo o un producto.';
    END IF;
END//

-- Validar exclusividad Insumo o Producto (UPDATE)
CREATE TRIGGER trg_inventario_chk_bu
BEFORE UPDATE ON inventario
FOR EACH ROW
BEGIN
    IF (NEW.id_insumo IS NULL AND NEW.id_producto IS NULL)
       OR (NEW.id_insumo IS NOT NULL AND NEW.id_producto IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Debe registrar exactamente un insumo o un producto.';
    END IF;
END//

-- Movimiento: Exclusividad
CREATE TRIGGER trg_movimiento_chk_bi
BEFORE INSERT ON movimiento_inventario
FOR EACH ROW
BEGIN
    IF (NEW.id_insumo IS NULL AND NEW.id_producto IS NULL)
       OR (NEW.id_insumo IS NOT NULL AND NEW.id_producto IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: El movimiento debe afectar a un insumo o a un producto.';
    END IF;
END//

CREATE TRIGGER trg_movimiento_chk_bu
BEFORE UPDATE ON movimiento_inventario
FOR EACH ROW
BEGIN
    IF (NEW.id_insumo IS NULL AND NEW.id_producto IS NULL)
       OR (NEW.id_insumo IS NOT NULL AND NEW.id_producto IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: El movimiento debe afectar a un insumo o a un producto.';
    END IF;
END//

-- Control de componentes personalizables
CREATE TRIGGER trg_validar_personalizable_bi
BEFORE INSERT ON configuracion_componente
FOR EACH ROW
BEGIN
    DECLARE v_personalizable BOOLEAN;
    SELECT p.es_personalizable INTO v_personalizable
    FROM configuracion_bebida cb
    JOIN producto p ON cb.id_producto = p.id_producto
    WHERE cb.id_configuracion = NEW.id_configuracion;

    IF v_personalizable = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Este producto está marcado como no personalizable.';
    END IF;
END//

-- Control de componentes personalizables (UPDATE) --
CREATE TRIGGER trg_validar_personalizable_bu
BEFORE UPDATE ON configuracion_componente
FOR EACH ROW
BEGIN
    DECLARE v_personalizable BOOLEAN;
    SELECT p.es_personalizable INTO v_personalizable
    FROM configuracion_bebida cb
    JOIN producto p ON cb.id_producto = p.id_producto
    WHERE cb.id_configuracion = NEW.id_configuracion;

    IF v_personalizable = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Este producto está marcado como no personalizable.';
    END IF;
END//
-- Validar monto de reembolsos (INSERT)
-- INSERT y UPDATE validan el estado del pago y limitan la suma de reembolsos; UPDATE excluye la fila editada.
CREATE TRIGGER trg_validar_monto_reembolso_bi
BEFORE INSERT ON reembolso
FOR EACH ROW
BEGIN
    DECLARE v_monto_pago DECIMAL(12,2);
    DECLARE v_estado_pago VARCHAR(30);
    DECLARE v_reembolsado_acumulado DECIMAL(12,2);

    SELECT monto, estado INTO v_monto_pago, v_estado_pago
    FROM pago WHERE id_pago = NEW.id_pago;

    IF v_estado_pago != 'aprobado' AND v_estado_pago != 'reembolsado_parcial' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Solo se pueden reembolsar pagos aprobados o parcialmente reembolsados.';
    END IF;

    SELECT COALESCE(SUM(monto), 0) INTO v_reembolsado_acumulado
    FROM reembolso WHERE id_pago = NEW.id_pago;

    IF (v_reembolsado_acumulado + NEW.monto) > v_monto_pago THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: El monto total acumulado a reembolsar supera el valor del pago.';
    END IF;
END//

DELIMITER //
CREATE TRIGGER trg_validar_monto_reembolso_bu
BEFORE UPDATE ON reembolso
FOR EACH ROW
BEGIN
    DECLARE v_monto_pago DECIMAL(12,2);
    DECLARE v_estado_pago VARCHAR(30);
    DECLARE v_reembolsado_acumulado DECIMAL(12,2);

    SELECT monto, estado INTO v_monto_pago, v_estado_pago
    FROM pago WHERE id_pago = NEW.id_pago;

    IF v_estado_pago != 'aprobado' AND v_estado_pago != 'reembolsado_parcial' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: Solo se pueden reembolsar pagos aprobados o parcialmente reembolsados.';
    END IF;

    SELECT COALESCE(SUM(monto), 0) INTO v_reembolsado_acumulado
    FROM reembolso WHERE id_pago = NEW.id_pago AND id_reembolso != NEW.id_reembolso;

    IF (v_reembolsado_acumulado + NEW.monto) > v_monto_pago THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error: El reembolso modificado superaría el valor total del pago.';
    END IF;
END//
DELIMITER ;

-- ============================================================
-- 14. PROCEDIMIENTOS ALMACENADOS (CON MANEJO DE ERRORES Y ROLLBACK)
-- ============================================================
DELIMITER //

-- Completa la orden en una transacción: valida existencias, consume lotes vigentes por FIFO,
-- registra movimientos y productos terminados; si falla un paso, revierte los cambios.
CREATE PROCEDURE sp_completar_orden_produccion(
    IN p_id_orden INT,
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_sucursal INT;
    DECLARE v_estado VARCHAR(20);
    DECLARE v_stock_suficiente INT DEFAULT 1;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_requerimiento;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Bloquear y validar la orden. El handler local distingue el caso sin fila.
    BEGIN
        DECLARE v_orden_no_encontrada BOOLEAN DEFAULT FALSE;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_orden_no_encontrada = TRUE;

        SELECT id_sucursal, estado INTO v_id_sucursal, v_estado
        FROM orden_produccion
        WHERE id_orden = p_id_orden
        FOR UPDATE;

        IF v_orden_no_encontrada THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La orden no existe.';
        END IF;
    END;

    IF v_estado NOT IN ('en_proceso', 'pendiente') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La orden no está lista para completarse.';
    END IF;

    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_requerimiento (
        id_insumo INT PRIMARY KEY,
        cantidad_total DECIMAL(12,4) NOT NULL
    );
    TRUNCATE TABLE tmp_requerimiento;

    -- Agrupar los consumos de la formulación base.
    INSERT INTO tmp_requerimiento (id_insumo, cantidad_total)
    SELECT fi.id_insumo, SUM(fi.cantidad * dop.cantidad_a_producir)
    FROM detalle_orden_produccion dop
    JOIN formulacion f ON dop.id_producto = f.id_producto AND f.vigente = TRUE
    JOIN formulacion_insumo fi ON f.id_formulacion = fi.id_formulacion
    WHERE dop.id_orden = p_id_orden
    GROUP BY fi.id_insumo
    ON DUPLICATE KEY UPDATE cantidad_total = cantidad_total + VALUES(cantidad_total);

    -- Agregar los consumos de componentes personalizados activos.
    INSERT INTO tmp_requerimiento (id_insumo, cantidad_total)
    SELECT ci.id_insumo, SUM(cc.cantidad * ci.cantidad_insumo_por_dosis * dop.cantidad_a_producir)
    FROM detalle_orden_produccion dop
    JOIN configuracion_componente cc ON dop.id_configuracion = cc.id_configuracion
    JOIN componente_insumo ci ON cc.id_componente = ci.id_componente
    WHERE dop.id_orden = p_id_orden AND ci.activo = TRUE
    GROUP BY ci.id_insumo
    ON DUPLICATE KEY UPDATE cantidad_total = cantidad_total + VALUES(cantidad_total);

    -- Tomar bloqueos antes de validar para evitar consumos concurrentes del mismo stock.
    UPDATE inventario i
    JOIN tmp_requerimiento req ON req.id_insumo = i.id_insumo
    SET i.cantidad = i.cantidad
    WHERE i.id_sucursal = v_id_sucursal;

    UPDATE lote_insumo l
    JOIN tmp_requerimiento req ON req.id_insumo = l.id_insumo
    SET l.cantidad_actual = l.cantidad_actual
    WHERE l.id_sucursal = v_id_sucursal AND l.estado = 'disponible' AND l.fecha_vencimiento >= CURDATE();

    SELECT IF(COUNT(*) = 0, 1, 0) INTO v_stock_suficiente
    FROM tmp_requerimiento req
    LEFT JOIN inventario inv
        ON req.id_insumo = inv.id_insumo AND inv.id_sucursal = v_id_sucursal
    WHERE inv.cantidad IS NULL OR inv.cantidad < req.cantidad_total;

    IF v_stock_suficiente = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock general insuficiente o falta una fila de inventario.';
    END IF;

    SELECT IF(COUNT(*) = 0, 1, 0) INTO v_stock_suficiente
    FROM tmp_requerimiento req
    LEFT JOIN (
        SELECT id_insumo, SUM(cantidad_actual) AS cantidad_lotes
        FROM lote_insumo
        WHERE id_sucursal = v_id_sucursal AND estado = 'disponible' AND fecha_vencimiento >= CURDATE()
        GROUP BY id_insumo
    ) lotes ON lotes.id_insumo = req.id_insumo
    WHERE lotes.cantidad_lotes IS NULL OR lotes.cantidad_lotes < req.cantidad_total;

    IF v_stock_suficiente = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente en los lotes disponibles y no vencidos.';
    END IF;

    -- Recorrer los insumos y descontar FIFO entre todos los lotes necesarios.
    BEGIN
        DECLARE v_req_insumo INT;
        DECLARE v_req_cantidad DECIMAL(12,4);
        DECLARE done_req BOOLEAN DEFAULT FALSE;
        DECLARE cur_req CURSOR FOR
            SELECT id_insumo, cantidad_total FROM tmp_requerimiento ORDER BY id_insumo;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done_req = TRUE;

        OPEN cur_req;
        req_loop: LOOP
            FETCH cur_req INTO v_req_insumo, v_req_cantidad;
            IF done_req THEN LEAVE req_loop; END IF;

            UPDATE inventario
            SET cantidad = cantidad - v_req_cantidad
            WHERE id_sucursal = v_id_sucursal AND id_insumo = v_req_insumo;

            BEGIN
                DECLARE v_lote_id INT;
                DECLARE v_lote_cantidad DECIMAL(12,3);
                DECLARE v_pendiente DECIMAL(12,4);
                DECLARE v_consumo DECIMAL(12,4);
                DECLARE done_lote BOOLEAN DEFAULT FALSE;
                DECLARE cur_lote CURSOR FOR
                    SELECT id_lote, cantidad_actual
                    FROM lote_insumo
                    WHERE id_insumo = v_req_insumo
                      AND id_sucursal = v_id_sucursal
                      AND estado = 'disponible'
                      AND fecha_vencimiento >= CURDATE()
                      AND cantidad_actual > 0
                    ORDER BY fecha_vencimiento, id_lote;
                DECLARE CONTINUE HANDLER FOR NOT FOUND SET done_lote = TRUE;

                SET v_pendiente = v_req_cantidad;
                OPEN cur_lote;
                lote_loop: LOOP
                    FETCH cur_lote INTO v_lote_id, v_lote_cantidad;
                    IF done_lote OR v_pendiente <= 0 THEN LEAVE lote_loop; END IF;

                    SET v_consumo = LEAST(v_lote_cantidad, v_pendiente);
                    UPDATE lote_insumo
                    SET estado = IF(cantidad_actual = v_consumo, 'agotado', estado),
                        cantidad_actual = cantidad_actual - v_consumo
                    WHERE id_lote = v_lote_id;

                    INSERT INTO movimiento_inventario
                        (id_sucursal, id_insumo, id_lote, tipo, cantidad, tipo_origen,
                         id_origen_referencia, id_usuario, observacion)
                    VALUES
                        (v_id_sucursal, v_req_insumo, v_lote_id, 'salida_produccion',
                         v_consumo, 'orden_produccion', p_id_orden, p_id_usuario,
                         'Consumo de lote por orden de producción');

                    SET v_pendiente = v_pendiente - v_consumo;
                END LOOP;
                CLOSE cur_lote;

                IF v_pendiente > 0 THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo cubrir el consumo con los lotes disponibles.';
                END IF;
            END;
        END LOOP;
        CLOSE cur_req;
    END;

    -- Ingresar los productos terminados y registrar sus movimientos.
    BEGIN
        DECLARE v_id_producto INT;
        DECLARE v_cant_producir INT;
        DECLARE done_prod BOOLEAN DEFAULT FALSE;
        DECLARE cur_prod CURSOR FOR
            SELECT id_producto, cantidad_a_producir
            FROM detalle_orden_produccion
            WHERE id_orden = p_id_orden;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done_prod = TRUE;

        OPEN cur_prod;
        prod_loop: LOOP
            FETCH cur_prod INTO v_id_producto, v_cant_producir;
            IF done_prod THEN LEAVE prod_loop; END IF;

            INSERT INTO inventario (id_sucursal, id_producto, cantidad)
            VALUES (v_id_sucursal, v_id_producto, v_cant_producir)
            ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad);

            INSERT INTO movimiento_inventario
                (id_sucursal, id_producto, tipo, cantidad, tipo_origen,
                 id_origen_referencia, id_usuario, observacion)
            VALUES
                (v_id_sucursal, v_id_producto, 'entrada_produccion', v_cant_producir,
                 'orden_produccion', p_id_orden, p_id_usuario,
                 'Ingreso de producto terminado');
        END LOOP;
        CLOSE cur_prod;
    END;

    UPDATE orden_produccion
    SET estado = 'completada', fecha_fin = NOW(), id_usuario_responsable = p_id_usuario
    WHERE id_orden = p_id_orden;

    DROP TEMPORARY TABLE IF EXISTS tmp_requerimiento;
    COMMIT;
END//
DELIMITER ;

-- ============================================================
-- 15. DATOS DE PRUEBA (CON LOTES INCLUIDOS)
-- ============================================================
INSERT INTO ubicacion (region, provincia, comuna, pais) VALUES
('Metropolitana', 'Santiago', 'Santiago', 'Chile'),
('Metropolitana', 'Santiago', 'Providencia', 'Chile');

INSERT INTO direccion (id_ubicacion, calle, numero, codigo_postal, referencia) VALUES
(1, 'Av. Principal', '1500', '8320000', 'Casa matriz Aquaroma'),
(2, 'Av. Providencia', '2200', '7500000', 'Sucursal Providencia');

INSERT INTO unidad_medida (codigo, nombre, familia, factor_a_base) VALUES
('ML', 'Mililitro', 'volumen', 1),
('L', 'Litro', 'volumen', 1000),
('UN', 'Unidad', 'unidad', 1);

INSERT INTO insumo (nombre, id_unidad, tipo_insumo, stock_minimo) VALUES
('Agua purificada', 2, 'ingrediente', 20),
('Esencia de limon', 1, 'ingrediente', 500),
('Esencia de frutos rojos', 1, 'ingrediente', 500),
('Botella 500 ml', 3, 'envase', 50),
('Etiqueta Aquaroma', 3, 'etiqueta', 50);

INSERT INTO proveedor (nombre, telefono, correo, id_direccion) VALUES
('Aromas Chile', '+56911111111', 'ventas@aromaschile.cl', 1);

INSERT INTO proveedor_insumo (id_proveedor, id_insumo, precio_ref, codigo_proveedor) VALUES
(1, 2, 15000, 'LIM-001'),
(1, 3, 17000, 'FR-001');

INSERT INTO componente (nombre, tipo, unidad_dosificacion, recargo_precio, descripcion) VALUES
('Limon', 'mixto', 'dosis', 300, 'Aroma y sabor suave de limon'),
('Frutos rojos', 'mixto', 'dosis', 400, 'Aroma dulce de frutos rojos');

INSERT INTO componente_insumo (id_componente, id_insumo, cantidad_insumo_por_dosis) VALUES
(1, 2, 5),
(2, 3, 5);

INSERT INTO tipo_agua (nombre, descripcion) VALUES
('Purificada', 'Agua sometida a proceso de purificacion');

INSERT INTO presentacion (nombre, volumen_ml, tipo_envase) VALUES
('Botella individual', 500, 'Botella PET');

INSERT INTO categoria (nombre, descripcion) VALUES
('Clasica', 'Linea tradicional Aquaroma');

INSERT INTO producto (sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base, es_personalizable) VALUES
('AQ-001', 'Aquaroma Clasica 500ml', 1, 1, 1, 1200, TRUE);

INSERT INTO formulacion (id_producto, version, vigente) VALUES
(1, '1.0', TRUE);

INSERT INTO formulacion_insumo (id_formulacion, id_insumo, cantidad) VALUES
(1, 1, 0.5),
(1, 4, 1),
(1, 5, 1);

INSERT INTO sucursal (nombre, telefono, id_direccion) VALUES
('Aquaroma Santiago', '+56211111111', 1),
('Aquaroma Providencia', '+56222222222', 2);

-- Cargar Inventario Base
INSERT INTO inventario (id_sucursal, id_insumo, id_producto, cantidad) VALUES
(1, 1, NULL, 500),
(1, 2, NULL, 2000),
(1, 3, NULL, 2000),
(1, 4, NULL, 500),
(1, 5, NULL, 500),
(1, NULL, 1, 20);

-- Cargar Lotes para permitir consumo (NUEVO)
INSERT INTO lote_insumo (id_insumo, id_sucursal, codigo_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual, estado) VALUES
(1, 1, 'LT-AGUA-01', '2028-12-31', 500, 500, 'disponible'),
(2, 1, 'LT-LIMON-01', '2028-12-31', 2000, 2000, 'disponible'),
(3, 1, 'LT-FRUTOS-01', '2028-12-31', 2000, 2000, 'disponible'),
(4, 1, 'LT-BOT-01', '2030-01-01', 500, 500, 'disponible'),
(5, 1, 'LT-ETIQ-01', '2030-01-01', 500, 500, 'disponible');

INSERT INTO cliente (nombre, apellido, telefono, correo) VALUES
('Benjamin', 'Perez', '+56933333333', 'benjamin@email.cl');

INSERT INTO cliente_direccion (id_cliente, id_direccion, es_principal, alias) VALUES
(1, 1, TRUE, 'Casa');

-- ============================================================
-- CUENTAS DE PRUEBA (solo para desarrollo; cambiarlas antes de publicar el sitio)
--   Rol            | Usuario (correo)    | Contraseña
--   Administrador  | admin@aquaroma.cl   | Admin.2026
--   Cliente        | benjamin@email.cl   | Cliente.2026
-- En la tabla se guarda el HASH bcrypt de cada contraseña, nunca la contraseña en texto plano.
-- ============================================================
-- Para cambiar una contraseña, genera un hash nuevo en la terminal del proyecto y pégalo aquí:
--   node -e "require('bcrypt').hash('NUEVA_CLAVE', 10).then(console.log)"
INSERT INTO usuario (correo, password_hash, id_cliente) VALUES
('admin@aquaroma.cl', '$2b$10$5IfOE6I1bb67q.qye8SytODUILWOUZDY4rE/OirqqrbWV12HR4dzS', NULL),
('benjamin@email.cl', '$2b$10$pGT7y1vQUHU0D9WHFM0K9.wpi0LbpTXwAzWoFPPij9G9S0V3LwMIG', 1);

INSERT INTO rol (nombre, descripcion) VALUES
('Administrador', 'Control completo'),
('Cliente', 'Usuario comprador');

INSERT INTO usuario_rol (id_usuario, id_rol) VALUES
(1, 1),
(2, 2);
-- Permisos por rol (HU-006). Cada historia del admin usará el suyo.
INSERT INTO permiso (nombre, descripcion) VALUES
('ver_panel_admin', 'Entrar al panel de administración'),
('gestionar_productos', 'Crear, editar y desactivar productos (HU-036, HU-037)'),
('gestionar_stock', 'Ver y ajustar el stock por sucursal (HU-038, HU-039)'),
('gestionar_pedidos', 'Ver pedidos y cambiar su estado (HU-040)'),
('ver_mensajes', 'Leer los mensajes de contacto (HU-035)'),
('comprar', 'Confirmar pedidos (HU-028)'),
('ver_mis_pedidos', 'Ver el historial propio (HU-031)');

-- Une cada rol con sus permisos buscando por nombre (así no dependemos de los id).
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r JOIN permiso p
WHERE (r.nombre = 'Administrador' AND p.nombre IN ('ver_panel_admin','gestionar_productos','gestionar_stock','gestionar_pedidos','ver_mensajes'))
   OR (r.nombre = 'Cliente' AND p.nombre IN ('comprar','ver_mis_pedidos'));



   
INSERT INTO configuracion_bebida (id_producto, id_cliente, nombre_display, precio_final) VALUES
(1, 1, 'Aquaroma Limon', 1500);

INSERT INTO configuracion_componente (id_configuracion, id_componente, cantidad) VALUES
(1, 1, 1);

INSERT INTO pedido (id_cliente, id_sucursal, estado, total, costo_envio) VALUES
(1, 1, 'pagado', 3000, 1000);

INSERT INTO detalle_pedido (id_pedido, id_configuracion, id_formulacion_aplicada, cantidad, precio_unitario) VALUES
(1, 1, 1, 2, 1500);

INSERT INTO orden_produccion (id_pedido, id_sucursal, id_usuario_responsable, estado) VALUES
(1, 1, 1, 'en_proceso');

INSERT INTO detalle_orden_produccion (id_orden, id_producto, id_configuracion, cantidad_a_producir) VALUES
(1, 1, 1, 2);

INSERT INTO metodo_pago (nombre) VALUES
('Debito'),
('Credito'),
('Transferencia');

INSERT INTO pago (id_pedido, id_metodo, monto, estado, referencia_externa, fecha_pago) VALUES
(1, 1, 4000, 'aprobado', 'PAY-001', NOW());

INSERT INTO envio (id_pedido, calle, numero, comuna, region, codigo_postal, transportista, tracking, estado) VALUES
(1, 'Av. Principal', '1500', 'Santiago', 'Metropolitana', '8320000', 'Aquaroma Express', 'TRK-001', 'preparando');

-- ============================================================
-- PRODUCTOS DEL CATÁLOGO WEB (HU-013, HU-016) Y STOCK INICIAL
-- ============================================================
-- Estos son los productos que se ven en /catalogo. Se crean en 4 pasos:
--   1) tipos de agua  2) aromas (categoria)  3) productos  4) stock en la sucursal 1.

-- 1) Tipos de agua. En el catálogo son el filtro "Tipo" (Con gas / Sin gas / Electrolitos).
INSERT INTO tipo_agua (nombre, descripcion) VALUES
('Con gas', 'Agua funcional con gas'),
('Sin gas', 'Agua funcional sin gas'),
('Electrolitos', 'Agua funcional con electrolitos');

-- 2) Aromas. Cada producto tiene uno, y el catálogo arma con ellos los filtros de "Aroma".
--    Los 5 últimos (desde Mango) son los sabores que se agregaron después.
INSERT INTO categoria (nombre, descripcion) VALUES
('Limón', 'Aroma de limón'),
('Menta', 'Aroma de menta'),
('Frutilla', 'Aroma de frutilla'),
('Pepino', 'Aroma de pepino'),
('Durazno', 'Aroma de durazno'),
('Arándano', 'Aroma de arándano'),
('Mango', 'Aroma de mango'),
('Frutos rojos', 'Aroma de frutos rojos'),
('Hibisco y rosa', 'Aroma de hibisco y rosa'),
('Limón y menta', 'Aroma de limón y menta'),
('Pepino y limón', 'Aroma de pepino y limón');

-- 3) Productos. En vez de escribir los id a mano (id_tipo_agua = 2, id_categoria = 7...),
--    se arma una tabla temporal "datos" con los NOMBRES y se usan JOIN para buscar el id
--    que corresponde a cada nombre. Así el script no falla si los id cambian.
--    Distribución por tipo de agua:
--      Sin gas:      Limón, Menta, Pepino, Hibisco y rosa, Pepino y limón
--      Con gas:      Frutilla, Arándano, Frutos rojos, Limón y menta
--      Electrolitos: Durazno, Mango
INSERT INTO producto
    (sku, nombre, id_tipo_agua, id_presentacion, id_categoria, precio_base,
     es_personalizable, descripcion, imagen)
-- Columnas que se insertan: los textos salen de "datos" y los id salen de los JOIN de abajo.
-- Todos cuestan $1.490 (precio_base) y se pueden personalizar (es_personalizable = TRUE).
SELECT datos.sku, datos.nombre, t.id_tipo_agua, pr.id_presentacion,
       c.id_categoria, 1490.00, TRUE, datos.descripcion, datos.imagen
FROM (
    -- Una fila por producto: SKU (código único), nombre, tipo de agua, aroma,
    -- descripción corta (la etiqueta de color del catálogo) e imagen (archivo en public/img).
    -- La primera fila define los nombres de las columnas (AS ...); las demás se unen con UNION ALL.
    SELECT 'AQ-LIM-500' AS sku, 'AQUAROMA Limón' AS nombre,
           'Sin gas' AS tipo, 'Limón' AS categoria,
           'Cítrico refrescante' AS descripcion, 'agua_limon.png' AS imagen
    UNION ALL SELECT 'AQ-MEN-500', 'AQUAROMA Menta',
           'Sin gas', 'Menta', 'Hierbas frescas', 'agua_menta.jpg'
    UNION ALL SELECT 'AQ-FRU-500', 'AQUAROMA Frutilla',
           'Con gas', 'Frutilla', 'Dulce y frutal', 'agua_frutilla.png'
    UNION ALL SELECT 'AQ-PEP-500', 'AQUAROMA Pepino',
           'Sin gas', 'Pepino', 'Ligero y natural', 'agua_pepino.png'
    UNION ALL SELECT 'AQ-DUR-500', 'AQUAROMA Durazno',
           'Electrolitos', 'Durazno', 'Suave y delicado', 'agua_durazno.png'
    UNION ALL SELECT 'AQ-ARA-500', 'AQUAROMA Arándano',
           'Con gas', 'Arándano', 'Antioxidante natural', 'agua_arandano.jpg'
    -- Sabores agregados después (sus imágenes ya estaban en public/img sin usarse):
    UNION ALL SELECT 'AQ-MAN-500', 'AQUAROMA Mango',
           'Electrolitos', 'Mango', 'Tropical y dulce', 'agua_mango.png'
    UNION ALL SELECT 'AQ-FRR-500', 'AQUAROMA Frutos rojos',
           'Con gas', 'Frutos rojos', 'Intenso y frutal', 'agua_frutos_rojos.png'
    UNION ALL SELECT 'AQ-HIB-500', 'AQUAROMA Hibisco y rosa',
           'Sin gas', 'Hibisco y rosa', 'Floral y delicado', 'hibisco_y_rosa.jpg'
    UNION ALL SELECT 'AQ-LYM-500', 'AQUAROMA Limón y menta',
           'Con gas', 'Limón y menta', 'Cítrico y herbal', 'limon_y_menta.jpg'
    UNION ALL SELECT 'AQ-PYL-500', 'AQUAROMA Pepino y limón',
           'Sin gas', 'Pepino y limón', 'Fresco y ligero', 'pepino_y_limon.jpg'
) AS datos
-- Busca el id del tipo de agua por su nombre (ej.: 'Sin gas' -> su id_tipo_agua).
JOIN tipo_agua t ON t.nombre = datos.tipo
-- Busca el id del aroma por su nombre (ej.: 'Mango' -> su id_categoria).
JOIN categoria c ON c.nombre = datos.categoria
-- Todos usan la misma presentación: botella de 500 ml (es el "Tamaño" que muestra la ficha).
JOIN presentacion pr ON pr.nombre = 'Botella individual' AND pr.volumen_ml = 500;

-- 4) Stock inicial de cada producto en la sucursal 1 (Aquaroma Santiago).
--    Se busca cada producto por su SKU. Con cantidad 0 el producto aparece "Agotado"
--    en el catálogo y en su ficha (Frutilla y Arándano), y su botón de compra se desactiva.
INSERT INTO inventario (id_sucursal, id_producto, cantidad)
SELECT 1, p.id_producto, datos.cantidad
FROM (
    SELECT 'AQ-LIM-500' AS sku, 20.000 AS cantidad
    UNION ALL SELECT 'AQ-MEN-500', 15.000
    UNION ALL SELECT 'AQ-FRU-500', 0.000     -- agotado
    UNION ALL SELECT 'AQ-PEP-500', 12.000
    UNION ALL SELECT 'AQ-DUR-500', 8.000
    UNION ALL SELECT 'AQ-ARA-500', 0.000     -- agotado
    UNION ALL SELECT 'AQ-MAN-500', 18.000
    UNION ALL SELECT 'AQ-FRR-500', 14.000
    UNION ALL SELECT 'AQ-HIB-500', 10.000
    UNION ALL SELECT 'AQ-LYM-500', 16.000
    UNION ALL SELECT 'AQ-PYL-500', 12.000
) AS datos
-- Convierte cada SKU en el id_producto que MySQL le asignó en el paso 3.
JOIN producto p ON p.sku = datos.sku;

-- ============================================================
-- DESCRIPCIÓN COMPLETA PARA LA FICHA DEL PRODUCTO (HU-016)
-- ============================================================
-- La ficha (/catalogo/<id>) muestra este texto debajo del precio. Se guarda en la columna
-- producto.descripcion_larga; la columna "descripcion" sigue siendo la etiqueta corta del catálogo.
-- CASE elige el texto según el SKU de cada fila (funciona como un "si es este SKU, pon este texto").
-- El WHERE limita el UPDATE a estos 11 productos. Además, MySQL Workbench (en modo seguro) no deja
-- hacer un UPDATE sin un WHERE sobre una columna clave como sku.
-- Para cambiar un texto después:  UPDATE producto SET descripcion_larga = '...' WHERE sku = 'AQ-MAN-500';
UPDATE producto SET descripcion_larga = CASE sku
    WHEN 'AQ-LIM-500' THEN 'Agua sin gas con el aroma cítrico del limón. Refrescante y ligera, ideal para acompañar las comidas o para hidratarte durante el día.'
    WHEN 'AQ-MEN-500' THEN 'Agua sin gas con aroma a menta fresca. Deja una sensación limpia y refrescante, perfecta después de hacer ejercicio o en los días de calor.'
    WHEN 'AQ-FRU-500' THEN 'Agua con gas con el aroma dulce de la frutilla. Burbujeante y frutal, una alternativa liviana a las bebidas azucaradas.'
    WHEN 'AQ-PEP-500' THEN 'Agua sin gas con aroma a pepino. Suave y muy fresca, para quienes buscan un sabor sutil y natural.'
    WHEN 'AQ-DUR-500' THEN 'Agua con electrolitos y aroma a durazno. Te ayuda a reponer minerales después de la actividad física, con un sabor suave y delicado.'
    WHEN 'AQ-ARA-500' THEN 'Agua con gas con aroma a arándano. Un sabor frutal e intenso, con burbujas finas que la hacen muy refrescante.'
    WHEN 'AQ-MAN-500' THEN 'Agua con electrolitos y aroma a mango. Un toque tropical y dulce que te acompaña mientras repones minerales después del ejercicio.'
    WHEN 'AQ-FRR-500' THEN 'Agua con gas con una mezcla de frutos rojos. Intensa y frutal, con burbujas que realzan su aroma.'
    WHEN 'AQ-HIB-500' THEN 'Agua sin gas con el aroma floral del hibisco y la rosa. Delicada y diferente, para regalarte una pausa durante el día.'
    WHEN 'AQ-LYM-500' THEN 'Agua con gas que combina el aroma cítrico del limón con la frescura de la menta. Una mezcla clásica y muy refrescante.'
    WHEN 'AQ-PYL-500' THEN 'Agua sin gas con aroma a pepino y un toque de limón. Fresca, ligera y fácil de tomar en cualquier momento.'
END
WHERE sku IN ('AQ-LIM-500','AQ-MEN-500','AQ-FRU-500','AQ-PEP-500','AQ-DUR-500','AQ-ARA-500',
              'AQ-MAN-500','AQ-FRR-500','AQ-HIB-500','AQ-LYM-500','AQ-PYL-500');

-- ============================================================
-- VENTAS DE PRUEBA PARA "MÁS VENDIDO" DEL INICIO (HU-008)
-- ============================================================
-- El inicio marca como "Más vendido" al producto activo con más unidades vendidas.
-- Solo cuentan los pedidos en estado pagado, preparando, enviado o entregado
-- (los pedidos en carrito, confirmados o cancelados no son ventas reales).
-- Resultado esperado con estos datos:
--   Menta  = 4 + 2 = 6 unidades  -> "Más vendido"
--   Limón  = 2 unidades
--   Pepino = 0 unidades (sus 10 están en un pedido CANCELADO, que no cuenta)
-- Son datos de PRUEBA: cuando existan compras reales (HU-028) se pueden borrar buscando
-- los pedidos con observacion LIKE 'Pedido de prueba HU-008%'.

-- En esta base, cada línea de un pedido apunta a una "configuración de bebida" (el producto
-- con sus posibles personalizaciones), no directo al producto. Por eso primero se crea una
-- configuración base, sin personalizar, para cada producto que se va a vender.
--   id_cliente = NULL y es_plantilla_global = TRUE: no es de un cliente en particular.
--   precio_final = precio_base: sin recargos de personalización.
INSERT INTO configuracion_bebida (id_producto, id_cliente, nombre_display, precio_final, es_plantilla_global)
SELECT id_producto, NULL, nombre, precio_base, TRUE FROM producto
WHERE sku IN ('AQ-MEN-500', 'AQ-LIM-500', 'AQ-PEP-500');

-- Guarda en variables (@...) el id de la configuración de cada producto, para usarlo en los
-- pedidos de abajo sin escribir números a mano. LIMIT 1 asegura que se tome un solo valor.
SET @cfg_menta  = (SELECT cb.id_configuracion FROM configuracion_bebida cb JOIN producto p ON p.id_producto = cb.id_producto
                   WHERE p.sku = 'AQ-MEN-500' AND cb.es_plantilla_global LIMIT 1);
SET @cfg_limon  = (SELECT cb.id_configuracion FROM configuracion_bebida cb JOIN producto p ON p.id_producto = cb.id_producto
                   WHERE p.sku = 'AQ-LIM-500' AND cb.es_plantilla_global LIMIT 1);
SET @cfg_pepino = (SELECT cb.id_configuracion FROM configuracion_bebida cb JOIN producto p ON p.id_producto = cb.id_producto
                   WHERE p.sku = 'AQ-PEP-500' AND cb.es_plantilla_global LIMIT 1);

-- Pedido 1 (ENTREGADO, sí cuenta): 4 Menta + 2 Limón. Total = 6 x $1.490 = $8.940.
-- Columnas: cliente 1 (Benjamin), sucursal 1, estado, total, costo de envío y una nota.
INSERT INTO pedido (id_cliente, id_sucursal, estado, total, costo_envio, observacion) VALUES
(1, 1, 'entregado', 8940, 0, 'Pedido de prueba HU-008');
-- LAST_INSERT_ID() devuelve el id del pedido recién creado, para colgarle sus líneas.
SET @pedido = LAST_INSERT_ID();
-- Líneas del pedido: (pedido, configuración del producto, cantidad, precio unitario).
-- El subtotal (cantidad x precio) lo calcula MySQL solo: es una columna generada.
INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES
(@pedido, @cfg_menta, 4, 1490),
(@pedido, @cfg_limon, 2, 1490);

-- Pedido 2 (PAGADO, sí cuenta): 2 Menta. Total = 2 x $1.490 = $2.980.
INSERT INTO pedido (id_cliente, id_sucursal, estado, total, costo_envio, observacion) VALUES
(1, 1, 'pagado', 2980, 0, 'Pedido de prueba HU-008');
SET @pedido = LAST_INSERT_ID();
INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES
(@pedido, @cfg_menta, 2, 1490);

-- Pedido 3 (CANCELADO, NO cuenta): 10 Pepino. Total = 10 x $1.490 = $14.900.
-- Sirve para demostrar que "Más vendido" usa solo ventas reales: si contara, ganaría Pepino.
INSERT INTO pedido (id_cliente, id_sucursal, estado, total, costo_envio, observacion) VALUES
(1, 1, 'cancelado', 14900, 0, 'Pedido de prueba HU-008 (cancelado, no cuenta como venta)');
SET @pedido = LAST_INSERT_ID();
INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES
(@pedido, @cfg_pepino, 10, 1490);

-- Pedido 4 (CONFIRMADO, todavía no cuenta como venta): 3 Limón. Total = 3 x $1.490 = $4.470.
-- Sirve para probar la gestión de pedidos del administrador (HU-040): es el primer paso de la
-- secuencia confirmado -> pagado -> en preparación -> enviado -> entregado.
INSERT INTO pedido (id_cliente, id_sucursal, estado, total, costo_envio, observacion) VALUES
(1, 1, 'confirmado', 4470, 0, 'Pedido de prueba HU-040');
SET @pedido = LAST_INSERT_ID();
INSERT INTO detalle_pedido (id_pedido, id_configuracion, cantidad, precio_unitario) VALUES
(@pedido, @cfg_limon, 3, 1490);

-- ============================================================
-- STOCK EN PROVIDENCIA Y STOCK MÍNIMO (HU-038, HU-039)
-- ============================================================
-- La sucursal 2 (Aquaroma Providencia) parte con algunos productos, para que la vista de stock
-- por sucursal (/admin/stock) muestre las dos. Mango queda bajo su mínimo (3 de 5): alerta.
INSERT INTO inventario (id_sucursal, id_producto, cantidad)
SELECT 2, p.id_producto, datos.cantidad
FROM (
    SELECT 'AQ-LIM-500' AS sku, 10.000 AS cantidad
    UNION ALL SELECT 'AQ-MEN-500', 8.000
    UNION ALL SELECT 'AQ-MAN-500', 3.000
) AS datos
JOIN producto p ON p.sku = datos.sku;
-- Durazno tiene 8 en Santiago: con un mínimo de 10 también aparece como stock bajo.
UPDATE inventario i JOIN producto p ON p.id_producto = i.id_producto
SET i.stock_minimo = 10
WHERE p.sku = 'AQ-DUR-500' AND i.id_sucursal = 1;

-- ============================================================
-- MENSAJES DE CONTACTO DE PRUEBA (HU-035)
-- ============================================================
-- El panel de administración muestra los mensajes sin leer. Uno ya está leído.
INSERT INTO mensaje_contacto (nombre, correo, asunto, mensaje, leido) VALUES
('Camila Rojas', 'camila@email.cl', 'Venta por mayor', 'Hola, ¿venden cajas de 12 botellas para eventos?', FALSE),
('Diego Soto', 'diego@email.cl', 'Consulta por envío', '¿Hacen despacho a Maipú?', FALSE),
('Valentina Muñoz', 'vale@email.cl', 'Felicitaciones', 'Me encantó el agua de hibisco y rosa.', TRUE);

-- Desactiva el producto antiguo de ejemplo "Aquaroma Clasica 500ml" (AQ-001) para que no
-- aparezca en el catálogo ni en el inicio. No se borra porque tiene pedidos y una receta asociados.
UPDATE producto SET activo = FALSE WHERE sku = 'AQ-001';

-- ============================================================
-- 16. VISTAS OFICIALES DE REPORTE (PUNTOS 49 Y 50 FILTRADOS)
-- ============================================================

-- Consolida los pedidos pagados o en curso y separa productos, envío y total facturado.
CREATE VIEW vw_ventas_consolidadas AS
SELECT
    p.id_pedido,
    p.fecha,
    c.nombre AS nombre_cliente,
    c.correo AS correo_cliente,
    p.estado,
    p.total AS total_productos,
    p.costo_envio,
    (p.total + p.costo_envio) AS total_facturado
FROM pedido p
JOIN cliente c ON p.id_cliente = c.id_cliente
WHERE p.estado IN ('pagado', 'preparando', 'enviado', 'entregado');

-- Resume por cliente sus pedidos válidos y el total gastado.
CREATE VIEW vw_ventas_por_cliente AS
SELECT
    c.id_cliente,
    c.nombre,
    c.apellido,
    COUNT(p.id_pedido) AS cantidad_pedidos_validos,
    SUM(p.total) AS total_gastado
FROM cliente c
JOIN pedido p ON c.id_cliente = p.id_cliente
WHERE p.estado IN ('pagado', 'preparando', 'enviado', 'entregado')
GROUP BY c.id_cliente, c.nombre, c.apellido;

-- Muestra el stock por sucursal y el nombre del insumo o producto asociado.
CREATE VIEW vw_stock_sucursal AS
SELECT
    s.nombre AS sucursal,
    COALESCE(ins.nombre, prod.nombre) AS item,
    i.cantidad
FROM inventario i
JOIN sucursal s ON i.id_sucursal = s.id_sucursal
LEFT JOIN insumo ins ON i.id_insumo = ins.id_insumo
LEFT JOIN producto prod ON i.id_producto = prod.id_producto;


-- Select de todos los usuarios y su rol --

SELECT
    u.id_usuario,
    u.correo,
    u.id_cliente,
    GROUP_CONCAT(r.nombre SEPARATOR ', ') AS roles
FROM usuario u
LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
LEFT JOIN rol r ON r.id_rol = ur.id_rol
GROUP BY u.id_usuario, u.correo, u.id_cliente;
