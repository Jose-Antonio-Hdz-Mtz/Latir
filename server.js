require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurar que el directorio uploads/ exista
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/'); },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Redirigir o servir la página principal por defecto
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Interfaz latir.html'));
});

// =====================================================================
// Conexión a PostgreSQL
// =====================================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
        console.log('✅ Conectado a PostgreSQL exitosamente');
        release();
    }
});

// =====================================================================
// 🔔 SERVICIO DE NOTIFICACIONES (Twilio SMS/WhatsApp Fallback & Logs)
// =====================================================================
const TWILIO_CONFIG = {
    accountSid:   process.env.TWILIO_ACCOUNT_SID   || '',
    authToken:    process.env.TWILIO_AUTH_TOKEN     || '',
    fromSms:      process.env.TWILIO_FROM_SMS       || '',
    fromWhatsapp: process.env.TWILIO_FROM_WHATSAPP  || ''
};

const NotificationService = {
    async sendNotification({ pacienteNombre, tutorNombre, telefono, monto, tipo = 'donacion' }) {
        if (!telefono) {
            console.log('⚠️ No se puede enviar notificación: Teléfono no disponible.');
            return { success: false, reason: 'Teléfono no disponible' };
        }

        let numLimpio = telefono.replace(/\D/g, '');
        if (numLimpio.length === 10) {
            numLimpio = '+52' + numLimpio;
        } else if (numLimpio.length === 12 && numLimpio.startsWith('52')) {
            numLimpio = '+' + numLimpio;
        } else if (!numLimpio.startsWith('+')) {
            numLimpio = '+' + numLimpio;
        }

        const formattedMonto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);

        let mensaje = '';
        if (tipo === 'donacion') {
            mensaje = `Hola ${tutorNombre || 'Familiar'}. ¡Excelentes noticias! El caso de ${pacienteNombre} ha recibido y acreditado una donación por un monto de ${formattedMonto}. Los fondos serán transferidos a tu cuenta CLABE registrada a la brevedad. Atentamente, Asociación LATIR.`;
        } else {
            mensaje = `Hola ${tutorNombre || 'Familiar'}. Se han asignado ${formattedMonto} desde el Fondo General LATIR al caso de ${pacienteNombre}. Los fondos se transferirán a tu cuenta CLABE registrada. ¡Seguimos de tu lado!`;
        }

        console.log(`\n======================================================================`);
        console.log(`🔔 [SIMULADOR DE NOTIFICACIÓN]`);
        console.log(`📱 Para: ${tutorNombre} (${numLimpio})`);
        console.log(`💬 Mensaje: "${mensaje}"`);
        console.log(`======================================================================\n`);

        if (TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken) {
            try {
                const twilio = require('twilio');
                const client = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);

                if (TWILIO_CONFIG.fromSms) {
                    await client.messages.create({ body: mensaje, from: TWILIO_CONFIG.fromSms, to: numLimpio });
                    console.log(`✅ [Twilio SMS] Notificación enviada con éxito a ${numLimpio}`);
                }
                if (TWILIO_CONFIG.fromWhatsapp) {
                    await client.messages.create({ body: mensaje, from: TWILIO_CONFIG.fromWhatsapp, to: `whatsapp:${numLimpio}` });
                    console.log(`✅ [Twilio WhatsApp] Notificación enviada con éxito a whatsapp:${numLimpio}`);
                }
                return { success: true, method: 'twilio' };
            } catch (err) {
                console.error('❌ Error enviando notificación mediante Twilio:', err.message);
                return { success: false, error: err.message, fallback: 'Simulada con éxito' };
            }
        }
        return { success: true, method: 'simulated' };
    }
};


// =====================================================================
// 🔹 1. PÚBLICO: Obtener TODOS LOS PACIENTES (Solo ACTIVOS)
// =====================================================================
app.get('/pacientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                P.pacienteid as id, P.nombre, P.edad, P.sexo,
                P.area, P.diagnostico, P.triage,
                TO_CHAR(P.fechaingreso, 'DD/MM/YYYY') as "fechaIngreso",
                P.necesidad, P.indice_gravedad as ig,
                P.recaudado, P.meta, P.donantes,
                P.clabe,
                T.nombre as "tutorNombre", T.parentesco, T.telefono,
                T.correo, T.municipio, T.nivel_socioeconomico as "nivelSocioeconomico",
                T.dependientes
            FROM paciente P
            LEFT JOIN tutor T ON P.pacienteid = T.pacienteid
            WHERE P.estado = 'Activo'
            ORDER BY P.indice_gravedad DESC
        `);

        const resultEv = await pool.query(`
            SELECT evidenciaid, pacienteid, ruta_archivo, descripcion, monto_comprobado,
                   TO_CHAR(fecha_subida, 'DD/MM/YYYY') as fecha
            FROM evidencia_gasto
            WHERE estado = 'Aprobada'
        `);
        const evidencias = resultEv.rows;

        const pacientes = result.rows.map(row => {
            const pacEv = evidencias.filter(e => e.pacienteid === row.id);
            return {
                id: row.id, nombre: row.nombre, edad: row.edad, sexo: row.sexo,
                area: row.area, diagnostico: row.diagnostico, triage: row.triage,
                fechaIngreso: row.fechaIngreso, necesidad: row.necesidad, ig: row.ig,
                recaudado: row.recaudado, meta: row.meta, donantes: row.donantes,
                clabe: row.clabe || '',
                evidencias: pacEv.map(e => ({
                    id: e.evidenciaid, ruta: e.ruta_archivo, desc: e.descripcion,
                    monto: e.monto_comprobado, fecha: e.fecha
                })),
                tutor: {
                    nombre: row.tutorNombre || 'No disponible',
                    parentesco: row.parentesco || '—',
                    telefono: row.telefono || '—',
                    correo: row.correo || '—',
                    municipio: row.municipio || '—',
                    nivelSocioeconomico: row.nivelSocioeconomico || '—',
                    dependientes: row.dependientes || '0'
                }
            };
        });
        res.json(pacientes);
    } catch (err) {
        console.error("❌ Error en GET /pacientes:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


// =====================================================================
// 🔹 2. PÚBLICO: Registrar Donación
// =====================================================================
app.post('/donar', async (req, res) => {
    const { pacienteId, monto, nombre, correo, metodo, recurrente, ocupacion, donanteId } = req.body;
    try {
        await pool.query(`
            INSERT INTO donacion (pacienteid, monto, metodo_pago, nombre_donante, correo_donante, ocupacion_donante, es_recurrente, donanteid, estado_transferencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente')
        `, [pacienteId, monto, metodo || 'Transferencia', nombre, correo, ocupacion || null, recurrente ? true : false, donanteId || null]);

        res.json({ success: true, message: 'Donación registrada (Pendiente de verificación)' });
    } catch (err) {
        console.error('❌ Error en /donar:', err);
        res.status(500).json({ success: false, error: 'No se pudo procesar la donación' });
    }
});


// =====================================================================
// 🔹 3. PÚBLICO: Enviar Solicitud de Apoyo (Para el Familiar) -> Entra 'Pendiente'
// =====================================================================
app.post('/solicitar', upload.fields([{ name: 'archivoCaso', maxCount: 1 }, { name: 'archivoIne', maxCount: 1 }]), async (req, res) => {
    const {
        pacienteId,
        nombre, edad, sexo, area, diagnostico, necesidad, hospitalCanseco,
        tutorNombre, tutorParentesco, tutorTelefono, tutorMunicipio, tutorNivel, tutorDependientes
    } = req.body;
    const archivoCaso = req.files && req.files['archivoCaso'] ? req.files['archivoCaso'][0].filename : null;
    const archivoIne  = req.files && req.files['archivoIne']  ? req.files['archivoIne'][0].filename  : null;

    if (!pacienteId) {
        return res.status(401).json({ success: false, error: 'Debes iniciar sesión o registrarte como paciente/tutor primero para enviar una solicitud.' });
    }

    try {
        const activePacienteId = parseInt(pacienteId);

        await pool.query(`
            UPDATE paciente
            SET nombre = $1, edad = $2, sexo = $3, area = $4, diagnostico = $5,
                triage = 'Por Evaluar', fechaingreso = NOW(), necesidad = $6,
                hospital_canseco = $7, archivo_caso = COALESCE($8, archivo_caso),
                estado = 'Pendiente'
            WHERE pacienteid = $9
        `, [nombre, edad, sexo, area, diagnostico, necesidad, hospitalCanseco === '1', archivoCaso, activePacienteId]);

        const tCheck = await pool.query(`SELECT tutorid FROM tutor WHERE pacienteid = $1`, [activePacienteId]);

        if (tCheck.rows.length > 0) {
            await pool.query(`
                UPDATE tutor
                SET nombre = $1, parentesco = $2, telefono = $3,
                    municipio = $4, nivel_socioeconomico = $5, dependientes = $6,
                    archivo_ine = COALESCE($7, archivo_ine)
                WHERE pacienteid = $8
            `, [tutorNombre, tutorParentesco, tutorTelefono, tutorMunicipio, tutorNivel, tutorDependientes, archivoIne, activePacienteId]);
        } else {
            await pool.query(`
                INSERT INTO tutor (pacienteid, nombre, parentesco, telefono, correo, municipio, nivel_socioeconomico, dependientes, archivo_ine)
                VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8)
            `, [activePacienteId, tutorNombre, tutorParentesco, tutorTelefono, tutorMunicipio, tutorNivel, tutorDependientes, archivoIne]);
        }

        res.json({ success: true, message: 'Solicitud enviada a revisión', id: activePacienteId });
    } catch (error) {
        console.error("❌ Error enviando solicitud:", error);
        res.status(500).json({ success: false, error: 'Hubo un error al enviar la solicitud' });
    }
});


// =====================================================================
// 🔹 4. ADMIN: Registrar Paciente Directo ('Activo')
// =====================================================================
app.post('/pacientes', async (req, res) => {
    const {
        nombre, edad, sexo, area, diagnostico, triage, necesidad, ig, meta,
        tutorNombre, tutorParentesco, tutorTelefono, tutorMunicipio, tutorNivel, tutorDependientes
    } = req.body;

    try {
        const pRes = await pool.query(`
            INSERT INTO paciente (nombre, edad, sexo, area, diagnostico, triage, fechaingreso, necesidad, indice_gravedad, meta, estado)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, 'Activo')
            RETURNING pacienteid
        `, [nombre, edad, sexo, area, diagnostico, triage, necesidad, ig, meta || 0]);

        const newPacienteId = pRes.rows[0].pacienteid;

        await pool.query(`
            INSERT INTO tutor (pacienteid, nombre, parentesco, telefono, correo, municipio, nivel_socioeconomico, dependientes)
            VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)
        `, [newPacienteId, tutorNombre, tutorParentesco, tutorTelefono, tutorMunicipio, tutorNivel, tutorDependientes]);

        res.json({ success: true, message: 'Paciente registrado', id: newPacienteId });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Hubo un error al registrar el paciente' });
    }
});


// =====================================================================
// 🔹 5. ADMIN: Obtener todos (Tablero Administrativo)
// =====================================================================
app.get('/admin/pacientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                P.pacienteid as id, P.nombre, P.estado, P.clabe,
                P.diagnostico, TO_CHAR(P.fechaingreso, 'DD/MM/YYYY') as "fechaIngreso",
                T.nombre as "tutorNombre", T.telefono
            FROM paciente P
            LEFT JOIN tutor T ON P.pacienteid = T.pacienteid
            ORDER BY P.fechaingreso DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error en admin dashboard" });
    }
});


// =====================================================================
// 🔹 5b. ADMIN: Detalle completo de un paciente (para revisión de solicitud)
// =====================================================================
app.get('/admin/pacientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                P.pacienteid as id, P.nombre, P.edad, P.sexo,
                P.area, P.diagnostico, P.triage,
                TO_CHAR(P.fechaingreso, 'DD/MM/YYYY') as "fechaIngreso",
                P.necesidad, P.indice_gravedad as ig, P.estado,
                P.hospital_canseco as "hospitalCanseco", P.archivo_caso as "archivoCaso",
                P.clabe,
                T.nombre as "tutorNombre", T.parentesco, T.telefono,
                T.correo, T.municipio,
                T.nivel_socioeconomico as "nivelSocioeconomico", T.dependientes,
                T.archivo_ine as "archivoIne"
            FROM paciente P
            LEFT JOIN tutor T ON P.pacienteid = T.pacienteid
            WHERE P.pacienteid = $1
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error obteniendo detalle paciente:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// =====================================================================
// 🔹 6. ADMIN: Aprobar paciente y publicar ('Pendiente' -> 'Activo')
// =====================================================================
app.put('/admin/pacientes/:id/aprobar', async (req, res) => {
    const { id } = req.params;
    const { ig, triage, meta } = req.body;
    try {
        await pool.query(`
            UPDATE paciente
            SET estado = 'Activo', indice_gravedad = $1, triage = $2, meta = $3
            WHERE pacienteid = $4 AND estado = 'Pendiente'
        `, [ig, triage, meta || 0, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'No se pudo aprobar.' });
    }
});


// =====================================================================
// 🔹 7. ADMIN: Rechazar solicitud
// =====================================================================
app.put('/admin/pacientes/:id/rechazar', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE paciente SET estado = 'Rechazado' WHERE pacienteid = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al rechazar' });
    }
});


// =====================================================================
// 🔹 ADMIN: Obtener transferencias pendientes
// =====================================================================
app.get('/admin/transferencias', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT donacionid, monto, nombre_donante, correo_donante, ocupacion_donante,
                   TO_CHAR(fecha_donacion, 'DD/MM/YYYY') as "Fecha"
            FROM donacion WHERE estado_transferencia = 'Pendiente'
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error en admin transferencias" });
    }
});


// =====================================================================
// 🔹 ADMIN: Aceptar o rechazar transferencia
// =====================================================================
app.put('/admin/transferencias/:id', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        const donacion = await pool.query(
            `SELECT pacienteid, monto, estado_transferencia FROM donacion WHERE donacionid = $1`, [id]
        );

        if (donacion.rows.length === 0) return res.status(404).json({ error: 'Donación no encontrada' });
        const d = donacion.rows[0];

        if (d.estado_transferencia === 'Aprobada') {
            return res.status(400).json({ error: 'Esta transferencia ya ha sido aprobada previamente.' });
        }

        await pool.query(`UPDATE donacion SET estado_transferencia = $1 WHERE donacionid = $2`, [estado, id]);

        if (estado === 'Aprobada' && d.pacienteid) {
            await pool.query(
                `UPDATE paciente SET recaudado = recaudado + $1, donantes = donantes + 1 WHERE pacienteid = $2`,
                [d.monto, d.pacienteid]
            );
            try {
                const pacInfo = await pool.query(`
                    SELECT P.nombre as "pacNombre", T.nombre as "tutorNombre", T.telefono
                    FROM paciente P
                    LEFT JOIN tutor T ON P.pacienteid = T.pacienteid
                    WHERE P.pacienteid = $1
                `, [d.pacienteid]);
                if (pacInfo.rows.length > 0) {
                    const info = pacInfo.rows[0];
                    NotificationService.sendNotification({
                        pacienteNombre: info.pacNombre,
                        tutorNombre:    info.tutorNombre,
                        telefono:       info.telefono,
                        monto:          d.monto,
                        tipo:           'donacion'
                    }).catch(err => console.error("Error asíncrono en notificación:", err));
                }
            } catch (errNotif) {
                console.error("Error consultando datos para notificación:", errNotif);
            }
        }

        res.json({ success: true, message: `Transferencia ${estado}` });
    } catch (err) {
        console.error("Error validando transferencia:", err);
        res.status(500).json({ success: false, error: 'Error al cambiar estado' });
    }
});


// =====================================================================
// 🔹 8. AUTH: Registro de Usuario — DESHABILITADO
// =====================================================================
app.post('/register', (req, res) => {
    res.status(403).json({ success: false, error: 'El registro de nuevos usuarios no está permitido. Contacte al administrador.' });
});


// =====================================================================
// 🔹 9. AUTH: Iniciar Sesión (Login)
// =====================================================================
app.post('/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const authRow = await pool.query(`
            SELECT usuarioid, nombre, rol FROM usuarios
            WHERE correo = $1 AND password = $2 AND rol = 'Admin'
        `, [correo, password]);

        if (authRow.rows.length > 0) {
            const user = authRow.rows[0];
            res.json({ success: true, user: { id: user.usuarioid, nombre: user.nombre, rol: user.rol } });
        } else {
            res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error del sistema al iniciar sesión.' });
    }
});


// =====================================================================
// 🔹 10. DONANTE: Registro
// =====================================================================
app.post('/donantes/register', async (req, res) => {
    const { nombre, correo, password, telefono, ocupacion } = req.body;
    if (!nombre || !correo || !password) {
        return res.status(400).json({ success: false, error: 'Nombre, correo y contraseña son obligatorios.' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO donante (nombre, correo, password, telefono, ocupacion)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING donanteid, nombre, correo
        `, [nombre, correo, password, telefono || null, ocupacion || null]);

        const d = result.rows[0];
        res.json({ success: true, donante: { id: d.donanteid, nombre: d.nombre, correo: d.correo } });
    } catch (err) {
        console.error('❌ Error en /donantes/register:', err);
        if (err.code === '23505') {
            res.status(409).json({ success: false, error: 'Este correo ya está registrado.' });
        } else {
            res.status(500).json({ success: false, error: 'Error al registrar la cuenta.' });
        }
    }
});


// =====================================================================
// 🔹 11. DONANTE: Login
// =====================================================================
app.post('/donantes/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const result = await pool.query(`
            SELECT donanteid, nombre, correo, telefono, ocupacion
            FROM donante
            WHERE correo = $1 AND password = $2
        `, [correo, password]);

        if (result.rows.length > 0) {
            const d = result.rows[0];
            res.json({ success: true, donante: {
                id: d.donanteid, nombre: d.nombre, correo: d.correo,
                telefono: d.telefono, ocupacion: d.ocupacion
            }});
        } else {
            res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
        }
    } catch (err) {
        console.error('❌ Error en /donantes/login:', err);
        res.status(500).json({ success: false, error: 'Error del servidor.' });
    }
});


// =====================================================================
// 🔹 12. DONANTE: Mis Donaciones (historial para el dashboard)
// =====================================================================
app.get('/donantes/:id/donaciones', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                D.donacionid, D.monto, D.metodo_pago, D.es_recurrente,
                TO_CHAR(D.fecha_donacion, 'DD/MM/YYYY') as "fechaDonacion",
                P.pacienteid as "pacienteId", P.nombre as "pacienteNombre",
                P.diagnostico, P.estado as "estadoPaciente",
                P.recaudado, P.meta, P.indice_gravedad as ig
            FROM donacion D
            LEFT JOIN paciente P ON D.pacienteid = P.pacienteid
            WHERE D.donanteid = $1
            ORDER BY D.fecha_donacion DESC
        `, [id]);

        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error en /donantes/:id/donaciones:', err);
        res.status(500).json({ error: 'Error al cargar donaciones.' });
    }
});


// =====================================================================
// 🔹 PACIENTES: Registro
// =====================================================================
app.post('/pacientes/register', async (req, res) => {
    const { nombre, correo, password, telefono } = req.body;
    if (!nombre || !correo || !password) {
        return res.status(400).json({ success: false, error: 'Nombre, correo y contraseña son obligatorios.' });
    }
    try {
        const checkRes = await pool.query(`SELECT pacienteid FROM paciente WHERE correo_acceso = $1`, [correo]);
        if (checkRes.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Este correo ya está registrado.' });
        }

        const result = await pool.query(`
            INSERT INTO paciente (nombre, edad, sexo, area, diagnostico, triage, fechaingreso, necesidad, indice_gravedad, recaudado, meta, donantes, correo_acceso, password, estado)
            VALUES ($1, 0, 'Masculino', 'No asignada', 'Sin registrar', 'Por Evaluar', NOW(), 'Sin registrar', 0, 0, 0, 0, $2, $3, 'Pre-registro')
            RETURNING pacienteid, nombre, correo_acceso, recaudado
        `, [nombre, correo, password]);

        const p = result.rows[0];

        await pool.query(`
            INSERT INTO tutor (pacienteid, nombre, parentesco, telefono, correo, municipio, nivel_socioeconomico, dependientes)
            VALUES ($1, $2, 'Paciente', $3, $4, 'Tampico', 'Bajo', '0')
        `, [p.pacienteid, nombre, telefono || '', correo]);

        res.json({ success: true, paciente: { id: p.pacienteid, nombre: p.nombre, correo: p.correo_acceso, recaudado: p.recaudado } });
    } catch (err) {
        console.error('❌ Error en /pacientes/register:', err);
        res.status(500).json({ success: false, error: 'Error al registrar la cuenta del paciente.' });
    }
});


// =====================================================================
// 🔹 PACIENTES: Login
// =====================================================================
app.post('/pacientes/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const result = await pool.query(`
            SELECT pacienteid, nombre, correo_acceso, recaudado, estado
            FROM paciente
            WHERE correo_acceso = $1 AND password = $2
        `, [correo, password]);

        if (result.rows.length > 0) {
            const p = result.rows[0];
            res.json({ success: true, paciente: { id: p.pacienteid, nombre: p.nombre, correo: p.correo_acceso, recaudado: p.recaudado, estado: p.estado } });
        } else {
            res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
        }
    } catch (err) {
        console.error('❌ Error en /pacientes/login:', err);
        res.status(500).json({ success: false, error: 'Error del servidor.' });
    }
});


// =====================================================================
// 🔹 PACIENTE: Obtener estado actual en tiempo real
// =====================================================================
app.get('/pacientes/estado/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT pacienteid as id, nombre, estado, recaudado, meta, clabe
            FROM paciente
            WHERE pacienteid = $1
        `, [id]);
        if (result.rows.length > 0) {
            res.json({ success: true, paciente: result.rows[0] });
        } else {
            res.status(404).json({ success: false, error: 'Paciente no encontrado.' });
        }
    } catch (err) {
        console.error('❌ Error en /pacientes/estado/:id:', err);
        res.status(500).json({ success: false, error: 'Error del servidor.' });
    }
});


// =====================================================================
// 🔹 PACIENTE: Actualizar número de tarjeta bancaria
// =====================================================================
app.put('/pacientes/:id/clabe', async (req, res) => {
    const { id } = req.params;
    const { clabe } = req.body;

    if (!clabe || !/^\d{16}$/.test(clabe)) {
        return res.status(400).json({ success: false, error: 'El número de tarjeta debe contener exactamente 16 dígitos numéricos.' });
    }
    try {
        await pool.query(`UPDATE paciente SET clabe = $1 WHERE pacienteid = $2`, [clabe, id]);
        res.json({ success: true, message: 'Número de tarjeta actualizado correctamente.' });
    } catch (err) {
        console.error('❌ Error actualizando número de tarjeta:', err);
        res.status(500).json({ success: false, error: 'Error interno del servidor al actualizar el número de tarjeta.' });
    }
});


// =====================================================================
// 🔹 PACIENTE: Subir evidencia de gasto
// =====================================================================
app.post('/pacientes/evidencia', upload.single('archivoEvidencia'), async (req, res) => {
    const { pacienteId, descripcion, monto } = req.body;
    const archivo = req.file ? req.file.filename : null;

    if (!archivo || !descripcion || !monto) {
        return res.status(400).json({ success: false, error: 'Faltan datos o archivo.' });
    }

    try {
        const pRes = await pool.query(`SELECT estado FROM paciente WHERE pacienteid = $1`, [pacienteId]);

        if (pRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Paciente no encontrado.' });
        }
        if (pRes.rows[0].estado !== 'Activo') {
            return res.status(403).json({
                success: false,
                error: 'Tu solicitud de apoyo aún no ha sido aprobada. Podrás subir comprobantes una vez que tu caso esté Activo y recibas donaciones.'
            });
        }

        await pool.query(`
            INSERT INTO evidencia_gasto (pacienteid, ruta_archivo, descripcion, monto_comprobado, estado)
            VALUES ($1, $2, $3, $4, 'Pendiente')
        `, [pacienteId, archivo, descripcion, monto]);

        res.json({ success: true, message: 'Evidencia enviada para revisión.' });
    } catch (err) {
        console.error('❌ Error en /pacientes/evidencia:', err);
        res.status(500).json({ success: false, error: 'Error al guardar evidencia.' });
    }
});


// =====================================================================
// 🔹 PACIENTE: Obtener evidencias propias
// =====================================================================
app.get('/pacientes/:id/evidencias', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT evidenciaid, ruta_archivo, descripcion, monto_comprobado, estado,
                   TO_CHAR(fecha_subida, 'DD/MM/YYYY') as "Fecha"
            FROM evidencia_gasto
            WHERE pacienteid = $1
            ORDER BY fecha_subida DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error obteniendo evidencias:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
});


// =====================================================================
// 🔹 ADMIN: Evidencias pendientes de revisión
// =====================================================================
app.get('/admin/evidencias', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT E.evidenciaid, E.pacienteid, E.ruta_archivo, E.descripcion,
                   E.monto_comprobado, E.estado,
                   TO_CHAR(E.fecha_subida, 'DD/MM/YYYY') as "Fecha",
                   P.nombre as "PacienteNombre"
            FROM evidencia_gasto E
            JOIN paciente P ON E.pacienteid = P.pacienteid
            WHERE E.estado = 'Pendiente'
            ORDER BY E.fecha_subida ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error en GET /admin/evidencias:', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.post('/admin/evidencias/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        await pool.query(`UPDATE evidencia_gasto SET estado = $1 WHERE evidenciaid = $2`, [estado, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error actualizando evidencia:', err);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});


// =====================================================================
// 🔹 13. ADMIN: Datos, balance e historial del Fondo General
// =====================================================================
app.get('/admin/fondo-general', async (req, res) => {
    try {
        const recibidoResult = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM donacion
            WHERE pacienteid IS NULL AND estado_transferencia = 'Aprobada'
        `);
        const recibido = parseFloat(recibidoResult.rows[0].total);

        const distribuidoResult = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM donacion
            WHERE metodo_pago = 'Fondo General'
        `);
        const distribuido = parseFloat(distribuidoResult.rows[0].total);

        const balance = recibido - distribuido;

        const donacionesGeneralResult = await pool.query(`
            SELECT donacionid, monto, nombre_donante, correo_donante, estado_transferencia,
                   TO_CHAR(fecha_donacion, 'DD/MM/YYYY') as "Fecha"
            FROM donacion
            WHERE pacienteid IS NULL
            ORDER BY fecha_donacion DESC
        `);

        const distribucionesResult = await pool.query(`
            SELECT D.donacionid, D.monto, P.nombre as "PacienteNombre",
                   TO_CHAR(D.fecha_donacion, 'DD/MM/YYYY') as "Fecha"
            FROM donacion D
            JOIN paciente P ON D.pacienteid = P.pacienteid
            WHERE D.metodo_pago = 'Fondo General'
            ORDER BY D.fecha_donacion DESC
        `);

        res.json({
            success: true,
            balance,
            recibido,
            distribuido,
            donaciones:     donacionesGeneralResult.rows,
            distribuciones: distribucionesResult.rows
        });
    } catch (err) {
        console.error('❌ Error en GET /admin/fondo-general:', err);
        res.status(500).json({ success: false, error: 'Error al obtener fondo general' });
    }
});


// =====================================================================
// 🔹 14. ADMIN: Distribuir saldo del Fondo General a un paciente
// =====================================================================
app.post('/admin/fondo-general/distribuir', async (req, res) => {
    const { pacienteId, monto } = req.body;
    if (!pacienteId || !monto || Number(monto) <= 0) {
        return res.status(400).json({ success: false, error: 'Paciente y monto válidos requeridos.' });
    }

    try {
        const recibidoResult = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM donacion
            WHERE pacienteid IS NULL AND estado_transferencia = 'Aprobada'
        `);
        const recibido = parseFloat(recibidoResult.rows[0].total);

        const distribuidoResult = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM donacion
            WHERE metodo_pago = 'Fondo General'
        `);
        const distribuido = parseFloat(distribuidoResult.rows[0].total);

        const balance = recibido - distribuido;
        if (balance < Number(monto)) {
            return res.status(400).json({ success: false, error: `Saldo insuficiente. Disponible: $${balance.toLocaleString()}` });
        }

        await pool.query(`
            INSERT INTO donacion (pacienteid, monto, metodo_pago, nombre_donante, correo_donante, ocupacion_donante, es_recurrente, estado_transferencia)
            VALUES ($1, $2, 'Fondo General', 'Fondo General LATIR', 'info@latir.org.mx', 'Comité Médico LATIR', false, 'Aprobada')
        `, [pacienteId, monto]);

        await pool.query(`
            UPDATE paciente
            SET recaudado = recaudado + $1, donantes = donantes + 1
            WHERE pacienteid = $2
        `, [monto, pacienteId]);

        try {
            const pacInfo = await pool.query(`
                SELECT P.nombre as "pacNombre", T.nombre as "tutorNombre", T.telefono
                FROM paciente P
                LEFT JOIN tutor T ON P.pacienteid = T.pacienteid
                WHERE P.pacienteid = $1
            `, [pacienteId]);
            if (pacInfo.rows.length > 0) {
                const info = pacInfo.rows[0];
                NotificationService.sendNotification({
                    pacienteNombre: info.pacNombre,
                    tutorNombre:    info.tutorNombre,
                    telefono:       info.telefono,
                    monto:          monto,
                    tipo:           'distribucion'
                }).catch(err => console.error("Error asíncrono en notificación fondo:", err));
            }
        } catch (errNotif) {
            console.error("Error consultando datos para notificación fondo:", errNotif);
        }

        res.json({ success: true, message: 'Fondo distribuido correctamente.' });
    } catch (err) {
        console.error('❌ Error en POST /admin/fondo-general/distribuir:', err);
        res.status(500).json({ success: false, error: 'Error al distribuir fondo general' });
    }
});


// =====================================================================
// 🔹 15. PÚBLICO: Obtener estadísticas de impacto globales para el home
// =====================================================================
app.get('/estadisticas', async (req, res) => {
    try {
        const totalResult = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM donacion
            WHERE estado_transferencia = 'Aprobada' AND metodo_pago != 'Fondo General'
        `);
        const totalRecaudado = parseFloat(totalResult.rows[0].total);

        const apoyadosResult = await pool.query(`
            SELECT COUNT(*) as cantidad FROM paciente
            WHERE estado = 'Activo' AND recaudado > 0
        `);
        const pacientesApoyados = parseInt(apoyadosResult.rows[0].cantidad);

        const verificadosResult = await pool.query(`
            SELECT COUNT(*) as cantidad FROM paciente
            WHERE estado = 'Activo'
        `);
        const casosVerificados = parseInt(verificadosResult.rows[0].cantidad);

        const donantesResult = await pool.query(`
            SELECT COUNT(DISTINCT nombre_donante) as cantidad FROM donacion
            WHERE estado_transferencia = 'Aprobada'
        `);
        const totalDonantes = parseInt(donantesResult.rows[0].cantidad);

        res.json({
            success: true,
            totalRecaudado,
            pacientesApoyados,
            casosVerificados,
            totalDonantes
        });
    } catch (err) {
        console.error('❌ Error en GET /estadisticas:', err);
        res.status(500).json({ error: "Error obteniendo estadísticas" });
    }
});


// =====================================================================
// Arrancar servidor
// =====================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("==============================================");
    console.log(`✅ Servidor LATIR corriendo en puerto ${PORT}`);
    console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log("==============================================");
});