-- =====================================================================
-- Base de Datos LATIR - Versión PostgreSQL
-- Lucha y Apoyo Transparente para Pacientes
-- =====================================================================

-- =====================================================================
-- 1. Tabla: paciente
-- =====================================================================
CREATE TABLE IF NOT EXISTS paciente (
    pacienteid      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    edad            INT NOT NULL DEFAULT 0,
    sexo            VARCHAR(20) NOT NULL DEFAULT 'No especificado',
    area            VARCHAR(100) NOT NULL DEFAULT 'No asignada',
    diagnostico     VARCHAR(255) NOT NULL DEFAULT 'Sin registrar',
    triage          VARCHAR(50) NOT NULL DEFAULT 'Por Evaluar',
    fechaingreso    DATE NOT NULL DEFAULT CURRENT_DATE,
    necesidad       VARCHAR(255) NOT NULL DEFAULT 'Sin registrar',
    indice_gravedad INT NOT NULL DEFAULT 0,
    recaudado       DECIMAL(18,2) DEFAULT 0,
    meta            DECIMAL(18,2) DEFAULT 0,
    donantes        INT DEFAULT 0,
    hospital_canseco BOOLEAN DEFAULT FALSE,
    archivo_caso    VARCHAR(255),
    estado          VARCHAR(50) DEFAULT 'Pre-registro',
    clabe           VARCHAR(20),
    correo_acceso   VARCHAR(150),
    password        VARCHAR(255)
);

-- =====================================================================
-- 2. Tabla: tutor
-- =====================================================================
CREATE TABLE IF NOT EXISTS tutor (
    tutorid                SERIAL PRIMARY KEY,
    pacienteid             INT UNIQUE NOT NULL REFERENCES paciente(pacienteid) ON DELETE CASCADE,
    nombre                 VARCHAR(150) NOT NULL,
    parentesco             VARCHAR(50) NOT NULL DEFAULT 'No especificado',
    telefono               VARCHAR(20) NOT NULL DEFAULT '',
    correo                 VARCHAR(150),
    municipio              VARCHAR(100) NOT NULL DEFAULT 'No especificado',
    nivel_socioeconomico   VARCHAR(50) NOT NULL DEFAULT 'No especificado',
    dependientes           VARCHAR(100) NOT NULL DEFAULT '0',
    archivo_ine            VARCHAR(255)
);

-- =====================================================================
-- 3. Tabla: donante
-- =====================================================================
CREATE TABLE IF NOT EXISTS donante (
    donanteid   SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    correo      VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    telefono    VARCHAR(20),
    ocupacion   VARCHAR(100)
);

-- =====================================================================
-- 4. Tabla: donacion
-- =====================================================================
CREATE TABLE IF NOT EXISTS donacion (
    donacionid            SERIAL PRIMARY KEY,
    pacienteid            INT REFERENCES paciente(pacienteid) ON DELETE SET NULL,
    donanteid             INT REFERENCES donante(donanteid) ON DELETE SET NULL,
    monto                 DECIMAL(18,2) NOT NULL,
    metodo_pago           VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
    nombre_donante        VARCHAR(150) NOT NULL DEFAULT '',
    correo_donante        VARCHAR(150) NOT NULL DEFAULT '',
    ocupacion_donante     VARCHAR(100),
    es_recurrente         BOOLEAN DEFAULT FALSE,
    fecha_donacion        TIMESTAMP DEFAULT NOW(),
    estado_transferencia  VARCHAR(50) DEFAULT 'Pendiente'
);

-- =====================================================================
-- 5. Tabla: usuarios (admin)
-- =====================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    usuarioid   SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    correo      VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    rol         VARCHAR(50) NOT NULL DEFAULT 'Admin'
);

-- =====================================================================
-- 6. Tabla: evidencia_gasto
-- =====================================================================
CREATE TABLE IF NOT EXISTS evidencia_gasto (
    evidenciaid       SERIAL PRIMARY KEY,
    pacienteid        INT NOT NULL REFERENCES paciente(pacienteid) ON DELETE CASCADE,
    ruta_archivo      VARCHAR(255),
    descripcion       VARCHAR(255),
    monto_comprobado  DECIMAL(18,2),
    estado            VARCHAR(50) DEFAULT 'Pendiente',
    fecha_subida      TIMESTAMP DEFAULT NOW()
);

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================

-- Pacientes de ejemplo
INSERT INTO paciente (nombre, edad, sexo, area, diagnostico, triage, fechaingreso, necesidad, indice_gravedad, recaudado, meta, donantes, estado) VALUES
('Juan Carlos Méndez Reyes',     47, 'Masculino', 'Urgencias — Cama 3',  'Fractura de fémur con complicaciones',                          'II — Urgente',    '2026-04-08', 'Medicamentos postquirúrgicos y material de osteosíntesis',              7,  0, 0, 0, 'Activo'),
('Sofía Alejandra Torres Luna',  23, 'Femenino',  'Urgencias — Cama 7',  'Apendicitis aguda perforada',                                   'I — Emergencia',  '2026-04-10', 'Cirugía de emergencia y antibióticos especializados',                  9,  0, 0, 0, 'Activo'),
('Ernesto Villarreal Campos',    61, 'Masculino', 'Urgencias — Cama 12', 'Infarto agudo al miocardio',                                    'I — Emergencia',  '2026-04-11', 'Medicamentos cardíacos de alto costo y estudios especializados',       10, 0, 0, 0, 'Activo'),
('Valeria Gómez Salinas',        35, 'Femenino',  'Urgencias — Cama 5',  'Trauma craneoencefálico moderado',                              'II — Urgente',    '2026-04-09', 'Estudios de neuroimagen y medicamentos neurológicos',                  6,  0, 0, 0, 'Activo'),
('Roberto Sánchez Peña',         54, 'Masculino', 'Urgencias — Cama 9',  'Insuficiencia renal aguda',                                     'II — Urgente',    '2026-04-07', 'Sesiones de diálisis de emergencia y medicamentos nefroprotectores',  8,  0, 0, 0, 'Activo');

-- Tutores de ejemplo
INSERT INTO tutor (pacienteid, nombre, parentesco, telefono, correo, municipio, nivel_socioeconomico, dependientes) VALUES
(1, 'Rosa María Reyes Vda. de Méndez',  'Esposa',  '833-XXX-XXXX', 'r.reyes@ejemplo.com',  'Ciudad Madero, Tamaulipas', 'Bajo',       '3 hijos menores de edad'),
(2, 'Miguel Ángel Torres Hernández',    'Padre',   '833-XXX-XXXX', 'm.torres@ejemplo.com', 'Tampico, Tamaulipas',       'Medio-bajo', '2 dependientes'),
(3, 'Laura Inés Campos de Villarreal',  'Hija',    '833-XXX-XXXX', 'l.campos@ejemplo.com', 'Ciudad Madero, Tamaulipas', 'Bajo',       'Pensionado, 1 dependiente'),
(4, 'Pedro Gómez Ríos',                'Hermano', '833-XXX-XXXX', 'p.gomez@ejemplo.com',  'Altamira, Tamaulipas',      'Medio-bajo', '2 hijos'),
(5, 'Carmen Peña de Sánchez',          'Esposa',  '833-XXX-XXXX', 'c.pena@ejemplo.com',   'Ciudad Madero, Tamaulipas', 'Bajo',       '3 dependientes');

-- Administrador por defecto
-- ⚠️ IMPORTANTE: Cambia la contraseña antes de usar en producción
INSERT INTO usuarios (nombre, correo, password, rol) VALUES
('Administrador LATIR', 'admin@latir.org.mx', 'admin123', 'Admin');
