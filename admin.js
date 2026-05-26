document.addEventListener("DOMContentLoaded", () => {
    // 🛡️ GUARDIA DE SEGURIDAD (Redirección si no está logeado)
    const user = LATIR_SESSION.proteger('admin', 'login.html?motivo=sesion_expirada');
    if (!user) return;
    if (user.rol !== 'Admin') {
        alert('❌ Acceso Restringido. Necesitas rol de Administrador.');
        LATIR_SESSION.limpiarTodo();
        window.location.href = 'login.html?motivo=acceso_denegado';
        return;
    }

    loadDashboard();
});

// Cambiador de Tabs
window.switchTab = (tabId, elementObj) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if(elementObj) elementObj.classList.add('active');
    else document.querySelector(`[onclick*="${tabId}"]`)?.classList.add('active');

    document.getElementById('tab-' + tabId).classList.add('active');

    if (tabId === 'pendientes' || tabId === 'activos') {
        loadDashboard();
    } else if (tabId === 'transferencias') {
        loadTransferencias();
    } else if (tabId === 'fondo') {
        loadFondoGeneral();
    } else if (tabId === 'gastos') {
        loadEvidencias();
    }
};

window.cerrarSesion = () => {
    LATIR_SESSION.limpiarTodo();
    window.location.href = 'login.html';
};

function sanitizeText(text) {
    if (!text) return text;
    const replacements = [
        ['Ã¡', 'a'], ['Ã©', 'e'], ['Ã­', 'i'], ['Ã³', 'o'], ['Ãº', 'u'],
        ['Ã±', 'n'], ['Ã', 'A'],  ['Ã‰', 'E'], ['Ã', 'I'],  ['Ã"', 'O'],
        ['Ãš', 'U'], ['Ã\'', 'N'],
        ['â€"', '-'], ['â€™', "'"], ['â€œ', '"'], ['â€', '"'],
        ['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'],
        ['Á', 'A'], ['É', 'E'], ['Í', 'I'], ['Ó', 'O'], ['Ú', 'U'],
        ['ñ', 'n'], ['Ñ', 'N'],
        ['ü', 'u'], ['Ü', 'U'],
        ['–', '-'], ['—', '-']
    ];
    let result = String(text);
    for (const [search, replace] of replacements) {
        result = result.split(search).join(replace);
    }
    return result;
}

function sanitizePatient(p) {
    if (!p) return p;
    const cleanP = { ...p };
    if (cleanP.nombre) cleanP.nombre = sanitizeText(cleanP.nombre);
    if (cleanP.area) cleanP.area = sanitizeText(cleanP.area);
    if (cleanP.diagnostico) cleanP.diagnostico = sanitizeText(cleanP.diagnostico);
    if (cleanP.necesidad) cleanP.necesidad = sanitizeText(cleanP.necesidad);
    if (cleanP.triage) cleanP.triage = sanitizeText(cleanP.triage);
    if (cleanP.tutorNombre) cleanP.tutorNombre = sanitizeText(cleanP.tutorNombre);
    if (cleanP.parentesco) cleanP.parentesco = sanitizeText(cleanP.parentesco);
    if (cleanP.municipio) cleanP.municipio = sanitizeText(cleanP.municipio);
    if (cleanP.nivelSocioeconomico) cleanP.nivelSocioeconomico = sanitizeText(cleanP.nivelSocioeconomico);
    if (cleanP.dependientes) cleanP.dependientes = sanitizeText(cleanP.dependientes);
    if (cleanP.clabe) cleanP.clabe = sanitizeText(cleanP.clabe);
    if (cleanP.telefono) cleanP.telefono = sanitizeText(cleanP.telefono);
    
    if (cleanP.tutor) {
        cleanP.tutor = { ...cleanP.tutor };
        if (cleanP.tutor.nombre) cleanP.tutor.nombre = sanitizeText(cleanP.tutor.nombre);
        if (cleanP.tutor.parentesco) cleanP.tutor.parentesco = sanitizeText(cleanP.tutor.parentesco);
        if (cleanP.tutor.municipio) cleanP.tutor.municipio = sanitizeText(cleanP.tutor.municipio);
        if (cleanP.tutor.nivelSocioeconomico) cleanP.tutor.nivelSocioeconomico = sanitizeText(cleanP.tutor.nivelSocioeconomico);
        if (cleanP.tutor.dependientes) cleanP.tutor.dependientes = sanitizeText(cleanP.tutor.dependientes);
        if (cleanP.tutor.telefono) cleanP.tutor.telefono = sanitizeText(cleanP.tutor.telefono);
    }
    return cleanP;
}

function sanitizeTransferencia(t) {
    if (!t) return t;
    const cleanT = { ...t };
    if (cleanT.NombreDonante) cleanT.NombreDonante = sanitizeText(cleanT.NombreDonante);
    if (cleanT.CorreoDonante) cleanT.CorreoDonante = sanitizeText(cleanT.CorreoDonante);
    if (cleanT.OcupacionDonante) cleanT.OcupacionDonante = sanitizeText(cleanT.OcupacionDonante);
    return cleanT;
}

// Cargar listas del dashboard (Pacientes)
async function loadDashboard() {
    try {
        const res = await fetch('http://localhost:3000/admin/pacientes');
        if(!res.ok) throw new Error("Falla cargando datos");
        let pacientes = await res.json();
        pacientes = pacientes.map(sanitizePatient);
        
        const listPendientes = document.getElementById('lista-pendientes');
        const listActivos = document.getElementById('lista-activos');
        if(!listPendientes || !listActivos) return;
        
        listPendientes.innerHTML = '';
        listActivos.innerHTML = '';

        let countPendientes = 0;
        let countActivos = 0;
        
        pacientes.forEach(p => {
            if (p.estado === 'Pendiente') {
                countPendientes++;
                const nomEsc = p.nombre.replace(/'/g,"\\'").replace(/"/g,"&quot;");
                listPendientes.innerHTML += `
                  <tr>
                    <td><div style="font-size:0.75rem; color:var(--text-light)">#ID: ${p.id}</div>${p.fechaIngreso}</td>
                    <td><b>${p.nombre}</b></td>
                    <td><span class="badge pendiente">EN REVISIÓN</span></td>
                    <td>${p.diagnostico}</td>
                    <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                      <button class="action-btn" style="border-color:var(--gold);color:var(--gold);" onclick="verDatosCompletos(${p.id})">👁️ Ver Datos</button>
                      <button class="action-btn" onclick="openEvaluar(${p.id}, '${nomEsc}')">📝 Evaluar</button>
                    </td>
                  </tr>
                `;
            } else if (p.estado === 'Activo') {
                countActivos++;
                const clabeText = p.clabe 
                    ? `<code style="font-family: monospace; letter-spacing: 1px; font-size: 0.95rem; color: #2A9D8F; background: rgba(42,157,143,0.06); padding: 4px 8px; border-radius: 4px;">${formatAdminCard(p.clabe)}</code> 
                       <button class="action-btn" style="padding: 2px 8px; font-size: 0.7rem; margin-left: 5px; border-color: #2A9D8F; color: #2A9D8F;" onclick="copiarCLABE('${p.clabe}')">📋 Copiar</button>`
                    : `<span style="color: var(--text-light); font-style: italic; font-size: 0.85rem;">No registrada</span>`;

                const waText = p.telefono 
                    ? `<div style="margin-top: 5px;">
                         <small style="color:var(--text-muted);">Familiar: ${p.tutorNombre || '—'} (${p.telefono})</small>
                         <button class="action-btn" style="padding: 2px 8px; font-size: 0.7rem; margin-left: 5px; border-color: #25D366; color: #25D366;" onclick="enviarWhatsAppManual('${p.tutorNombre}', '${p.telefono}', '${p.nombre}', '0', 'general')">💬 WA</button>
                       </div>`
                    : '';

                listActivos.innerHTML += `
                  <tr>
                    <td><div style="font-size:0.75rem; color:var(--text-light)">#ID: ${p.id}</div>${p.fechaIngreso}</td>
                    <td><b>${p.nombre}</b></td>
                    <td><span class="badge activo">PUBLICADO</span></td>
                    <td>${p.diagnostico}</td>
                    <td>
                      <div>${clabeText}</div>
                      ${waText}
                    </td>
                  </tr>
                `;
            }
        });

        if (countPendientes === 0) listPendientes.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:30px;">No hay solicitudes pendientes de revisión. ¡Excelente!</td></tr>`;
        if (countActivos === 0) listActivos.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding:30px;">No hay pacientes activos actualmente.</td></tr>`;
        
    } catch (err) {
        console.error("Error al cargar dashboard:", err);
    }
}

// 🏦 CARGAR TRANSFERENCIAS
async function loadTransferencias() {
    const list = document.getElementById('lista-transferencias');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando transferencias...</td></tr>';

    try {
        const res = await fetch('http://localhost:3000/admin/transferencias');
        let data = await res.json();
        data = data.map(sanitizeTransferencia);
        list.innerHTML = '';

        if(data.length === 0) {
            list.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:30px;">No hay transferencias pendientes de verificar.</td></tr>`;
            return;
        }

        data.forEach(t => {
            list.innerHTML += `
              <tr>
                <td><div style="font-size:0.75rem; color:var(--text-light)">#ID: ${t.DonacionID}</div>${t.Fecha}</td>
                <td><b>${t.NombreDonante}</b></td>
                <td>${t.CorreoDonante}<br><small>${t.OcupacionDonante || '—'}</small></td>
                <td><b style="color:var(--terracota)">$${Number(t.Monto).toLocaleString()}</b></td>
                <td style="display:flex;gap:6px;">
                  <button class="action-btn" style="border-color:#2A9D8F;color:#2A9D8F;" onclick="validarTransferencia(${t.DonacionID}, 'Aprobada')">✅ Aceptar</button>
                  <button class="action-btn" style="border-color:#b91c1c;color:#b91c1c;" onclick="validarTransferencia(${t.DonacionID}, 'Rechazada')">✕ Rechazar</button>
                </td>
              </tr>
            `;
        });
    } catch (err) {
        console.error(err);
        list.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--terracota);">Error al cargar transferencias.</td></tr>`;
    }
}

window.validarTransferencia = async (id, estado) => {
    const confirmMsg = estado === 'Aprobada' 
        ? '¿Confirmas que has verificado esta transferencia en el banco y deseas acreditarla al paciente?' 
        : '¿Deseas rechazar esta transferencia?';
    
    if(!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`http://localhost:3000/admin/transferencias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        if(res.ok) {
            loadTransferencias();
        } else {
            alert('Error al procesar la transferencia');
        }
    } catch (err) {
        console.error(err);
    }
};

// Lógica del Modal Evaluar — carga datos completos del paciente
window._currentPacienteModal = null;

window.openEvaluar = async (id, nombre) => {
    // Resetear el modal y mostrarlo de inmediato
    document.getElementById('evaluar-id').value = id;
    document.getElementById('modal-patient-nombre').textContent = '⏳ Cargando...';
    document.getElementById('evaluar-triage').value = '';
    document.getElementById('evaluar-ig').value = '';
    document.getElementById('evaluar-meta').value = '0';
    document.getElementById('ig-badge-preview').innerHTML = '';
    // Reset mini-tabs
    document.querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mini-tab')[0]?.classList.add('active');
    document.getElementById('mini-tab-paciente').style.display = 'block';
    document.getElementById('mini-tab-tutor').style.display = 'none';
    document.getElementById('modal-evaluar').classList.add('open');

    try {
        const res = await fetch(`http://localhost:3000/admin/pacientes/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el paciente');
        let p = await res.json();
        p = sanitizePatient(p);
        window._currentPacienteModal = p;

        // Llenar header
        document.getElementById('modal-patient-nombre').textContent = p.nombre;

        // Llenar datos del paciente
        document.getElementById('md-edad').textContent        = `${p.edad} años · ${p.sexo}`;
        document.getElementById('md-area').textContent        = p.area || '—';
        document.getElementById('md-diagnostico').textContent = p.diagnostico || '—';
        document.getElementById('md-necesidad').textContent   = p.necesidad || '—';
        document.getElementById('md-fecha').textContent       = p.fechaIngreso || '—';
        
        // Nuevos campos
        const cansecoEl = document.getElementById('md-canseco');
        if(cansecoEl) cansecoEl.textContent = p.hospitalCanseco ? 'Sí, Hospital Canseco' : 'No, otro hospital';
        
        const archivoEl = document.getElementById('md-archivo');
        if(archivoEl) {
            if(p.archivoCaso) {
                archivoEl.innerHTML = `<a href="http://localhost:3000/uploads/${p.archivoCaso}" target="_blank" style="color:var(--terracota); text-decoration:underline;">📄 Ver evidencia adjunta</a>`;
            } else {
                archivoEl.textContent = 'Sin archivo adjunto';
            }
        }

        // Llenar datos del tutor
        document.getElementById('md-tutor-nombre').textContent      = p.tutorNombre || '—';
        document.getElementById('md-tutor-parentesco').textContent  = p.parentesco || '—';
        document.getElementById('md-tutor-telefono').textContent    = p.telefono || '—';
        document.getElementById('md-tutor-municipio').textContent   = p.municipio || '—';
        document.getElementById('md-tutor-nivel').textContent       = p.nivelSocioeconomico || '—';
        document.getElementById('md-tutor-dep').textContent         = p.dependientes || '—';
        
        const tutorIneEl = document.getElementById('md-tutor-ine');
        if (tutorIneEl) {
            if (p.archivoIne) {
                tutorIneEl.innerHTML = `<a href="http://localhost:3000/uploads/${p.archivoIne}" target="_blank" style="color:var(--terracota); text-decoration:underline;">📄 Ver INE adjunto</a>`;
            } else {
                tutorIneEl.textContent = 'Sin archivo adjunto';
            }
        };

        // ✅ AUTO-CALCULAR IG
        const triageAdminEl = document.getElementById('evaluar-triage');
        if (p.triage && p.triage !== 'Por Evaluar' && triageAdminEl) {
            const opciones = triageAdminEl.querySelectorAll('option');
            opciones.forEach(opt => {
                if (p.triage && opt.value && p.triage.includes(opt.value.split(' ')[0])) {
                    triageAdminEl.value = opt.value;
                }
            });
        }
        if (triageAdminEl && triageAdminEl.value) {
            autoCalcIG();
        }

    } catch (err) {
        console.error('Error cargando datos del paciente:', err);
        document.getElementById('modal-patient-nombre').textContent = nombre + ' (error al cargar datos)';
    }
};

// Cambia entre mini-tabs del modal (Paciente / Tutor)
window.switchMiniTab = (tabName, btn) => {
    document.querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('mini-tab-paciente').style.display = tabName === 'paciente' ? 'block' : 'none';
    document.getElementById('mini-tab-tutor').style.display    = tabName === 'tutor'    ? 'block' : 'none';
};

// Calcula el IG en base a Triage + Nivel socioeconómico + Dependientes + Días de espera
function calcularIG(triage, nivelSocio, dependientesStr, fechaIngreso) {
    let score = 0;

    // Triage — peso: 4 pts
    if      (triage.includes('I —') || triage.includes('I -'))   score += 4;
    else if (triage.includes('II'))                               score += 3;
    else if (triage.includes('III'))                              score += 1;

    // Nivel socioeconómico — peso: 3 pts
    const nivel = (nivelSocio || '').toLowerCase().trim();
    if      (nivel === 'bajo')                                      score += 3;
    else if (nivel.includes('medio-bajo') || nivel.includes('medio bajo')) score += 2;
    else if (nivel === 'medio')                                    score += 1;

    // Dependientes — peso: 2 pts
    const depMatch = dependientesStr ? dependientesStr.match(/\d+/) : null;
    const depNum   = depMatch ? parseInt(depMatch[0]) : 0;
    if      (depNum >= 4) score += 2;
    else if (depNum >= 1) score += 1;

    // Días de espera — peso: 2 pts
    if (fechaIngreso) {
        let ingreso;
        const parts = fechaIngreso.split('/');
        if (parts.length === 3) {
            ingreso = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
            ingreso = new Date(fechaIngreso);
        }
        const dias = Math.floor((Date.now() - ingreso.getTime()) / (1000 * 60 * 60 * 24));
        if      (dias >= 7) score += 2;
        else if (dias >= 3) score += 1;
    }

    return Math.max(1, Math.min(10, Math.round((score / 11) * 10)));
}

// Se llama cuando el admin cambia el Triage en el modal
window.autoCalcIG = () => {
    const p       = window._currentPacienteModal;
    const triage  = document.getElementById('evaluar-triage').value;
    if (!triage || !p) return;

    const ig = calcularIG(triage, p.nivelSocioeconomico, p.dependientes, p.fechaIngreso);
    document.getElementById('evaluar-ig').value = ig;

    let badgeClass = 'ig-bajo', badgeText = 'Seguimiento';
    if      (ig >= 9) { badgeClass = 'ig-critico';  badgeText = 'Emergencia'; }
    else if (ig >= 7) { badgeClass = 'ig-critico';  badgeText = 'Crítico'; }
    else if (ig >= 5) { badgeClass = 'ig-urgente';  badgeText = 'Urgente'; }
    else if (ig >= 3) { badgeClass = 'ig-mod';      badgeText = 'Moderado'; }

    document.getElementById('ig-badge-preview').innerHTML =
        `<span class="ig-preview-badge ${badgeClass}">IG ${ig} — ${badgeText}</span>`;
};


window.closeModal = () => {
    document.getElementById('modal-evaluar').classList.remove('open');
};

// Aprobar (Pasar de Pendiente a Activo)
document.getElementById('evaluarForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('evaluar-id').value;
    const data = {
        triage: document.getElementById('evaluar-triage').value,
        ig: document.getElementById('evaluar-ig').value,
        meta: document.getElementById('evaluar-meta').value
    };

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Aprobando...";

    try {
        const res = await fetch(`http://localhost:3000/admin/pacientes/${id}/aprobar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if(res.ok) {
            closeModal();
            loadDashboard();
        } else {
            alert('❌ Error al aprobar');
        }
    } catch (err) {
        console.error(err);
    } finally {
        btn.disabled = false; btn.textContent = "Aprobar y Publicar 🚀";
    }
});

// Rechazar Solicitud
window.rechazarCaso = async () => {
    if(!confirm('¿Estás seguro que deseas rechazar esta solicitud? Desaparecerá de pendientes y no se publicará.')) return;
    
    const id = document.getElementById('evaluar-id').value;
    try {
        const res = await fetch(`http://localhost:3000/admin/pacientes/${id}/rechazar`, { method: 'PUT' });
        if(res.ok) {
            closeModal();
            loadDashboard();
        } else {
            alert('Error al rechazar');
        }
    } catch(err) {
        console.error(err);
    }
};

// Registrar Directo (Formulario Tab 4)
document.getElementById('adminForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    data.edad = parseInt(data.edad);
    data.ig = parseInt(data.ig);
    data.meta = data.meta ? parseFloat(data.meta) : 0;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Guardando en BD...';

    try {
        const res = await fetch('http://localhost:3000/pacientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok && result.success) {
            alert('¡Paciente registrado con éxito y publicado directamente!');
            e.target.reset();
            document.querySelectorAll('.tab-btn')[1].click();
        } else {
            alert('❌ Error del servidor: ' + (result.error || 'Desconocido'));
        }
    } catch (error) {
        console.error(error);
        alert('❌ Error de conexión al crear paciente de forma directa.');
    } finally {
        btn.disabled = false; btn.textContent = 'Crear y Publicar Paciente';
    }
});

// ═══════════════════════════════════════════════════
// 👁️  VER DATOS COMPLETOS — Modal de solo lectura
// ═══════════════════════════════════════════════════
window.verDatosCompletos = async (id) => {
    const modal = document.getElementById('modal-datos-completos');
    const body  = document.getElementById('mdc-body');
    if (!modal || !body) return;

    body.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-muted);">⏳ Cargando datos...</p>';
    modal.classList.add('open');

    try {
        const res = await fetch(`http://localhost:3000/admin/pacientes/${id}`);
        if (!res.ok) throw new Error('no encontrado');
        let p = await res.json();
        p = sanitizePatient(p);

        const igSug = calcularIG('', p.nivelSocioeconomico, p.dependientes, p.fechaIngreso);

        const row = (label, val) => val
            ? `<div class="dato-campo"><span class="dato-label">${label}</span><span class="dato-val">${val}</span></div>`
            : '';

        const evidenciaHtml = p.archivoCaso 
            ? `<div class="dato-campo"><span class="dato-label">Evidencia adjunta</span><span class="dato-val"><a href="http://localhost:3000/uploads/${p.archivoCaso}" target="_blank" style="color:var(--terracota); text-decoration:underline;">Ver archivo (Foto/PDF)</a></span></div>`
            : '';

        const ineHtml = p.archivoIne 
            ? `<div class="dato-campo"><span class="dato-label">INE del Tutor</span><span class="dato-val"><a href="http://localhost:3000/uploads/${p.archivoIne}" target="_blank" style="color:var(--terracota); text-decoration:underline;">Ver INE (Foto/PDF)</a></span></div>`
            : '';

        body.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;">

            <!-- PACIENTE -->
            <div>
              <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:12px;">
                🧑‍⚕️ Datos del Paciente
              </p>
              ${row('Nombre completo', p.nombre)}
              ${row('Edad / Sexo', `${p.edad} años · ${p.sexo}`)}
              ${row('Área / Servicio', p.area)}
              ${row('Diagnóstico', p.diagnostico)}
              ${row('Necesidad principal', p.necesidad)}
              ${row('Hospital General Canseco', p.hospitalCanseco ? 'Sí' : 'No')}
              ${row('N° de Tarjeta', p.clabe ? `<code style="font-family: monospace; font-size:1rem; color:#2A9D8F; background:rgba(42,157,143,0.06); padding:2px 6px; border-radius:4px;">${formatAdminCard(p.clabe)}</code> <button type="button" class="action-btn" style="padding: 1px 6px; font-size: 0.65rem;" onclick="copiarCLABE('${p.clabe}')">Copiar</button>` : 'No registrada')}
              ${evidenciaHtml}
              ${row('Fecha de ingreso', p.fechaIngreso)}
              ${row('Triage declarado', p.triage)}
              ${row('Estado actual', p.estado)}
            </div>

            <!-- TUTOR -->
            <div>
              <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:12px;">
                👨‍👩‍👧 Datos del Familiar / Tutor
              </p>
              ${row('Nombre del tutor', p.tutorNombre)}
              ${row('Parentesco', p.parentesco)}
              ${row('Teléfono', p.telefono)}
              ${row('Correo', p.correo)}
              ${row('Municipio', p.municipio)}
              ${row('Nivel socioeconómico', p.nivelSocioeconomico)}
              ${row('Dependientes económicos', p.dependientes)}
              ${ineHtml}
            </div>
          </div>

          <!-- IG Sugerido -->
          <div style="margin-top:20px;padding:14px 18px;background:rgba(212,162,76,0.08);border:1px solid rgba(212,162,76,0.3);border-radius:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:1.4rem;">📊</span>
            <div>
              <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:0 0 2px 0;">IG Sugerido por el Sistema</p>
              <p style="font-size:1rem;font-weight:700;color:var(--brown-dark);margin:0;">
                IG ${igSug} —
                <span style="color:${igSug>=7?'#b91c1c':igSug>=5?'#c0522a':igSug>=3?'#b8882a':'#4a8a4a'}">
                  ${igSug>=9?'Emergencia':igSug>=7?'Crítico':igSug>=5?'Urgente':igSug>=3?'Moderado':'Seguimiento'}
                </span>
              </p>
              <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0 0;">Basado en: nivel socioeconómico, dependientes y días de espera. <em>El Triage oficial lo asigna el comité.</em></p>
            </div>
          </div>

          <!-- Botón Pasar a Evaluar -->
          <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:10px;">
            <button class="action-btn" style="border-color:#94a3b8;color:#94a3b8;" onclick="cerrarDatosCompletos()">Cerrar</button>
            <button class="btn-primary" onclick="cerrarDatosCompletos(); openEvaluar(${p.id}, '${(p.nombre||'').replace(/'/g,"\\'")}')">📝 Pasar a Evaluar →</button>
          </div>
        `;

    } catch (err) {
        body.innerHTML = '<p style="text-align:center;padding:20px;color:var(--terracota);">❌ No se pudo cargar la información del paciente.</p>';
    }
};

window.cerrarDatosCompletos = () => {
    document.getElementById('modal-datos-completos')?.classList.remove('open');
};

async function loadFondoGeneral() {
    try {
        const res = await fetch('http://localhost:3000/admin/fondo-general');
        if (!res.ok) throw new Error("Falla cargando fondo general");
        const data = await res.json();
        
        // Actualizar tarjetas de balance
        document.getElementById('fondo-disponible').textContent = `$${Number(data.balance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('fondo-recibido').textContent = `$${Number(data.recibido).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('fondo-asignado').textContent = `$${Number(data.distribuido).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

        // Guardar balance como max en el input de monto
        const montoInput = document.getElementById('distribuir-monto');
        if (montoInput) {
            montoInput.max = data.balance;
        }

        // Cargar lista de donaciones al fondo
        const listDonaciones = document.getElementById('lista-donaciones-fondo');
        if (listDonaciones) {
            listDonaciones.innerHTML = '';
            if (data.donaciones.length === 0) {
                listDonaciones.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 15px;">No hay donaciones al Fondo General registradas.</td></tr>';
            } else {
                data.donaciones.forEach(d => {
                    const badgeClass = d.EstadoTransferencia === 'Aprobada' ? 'badge activo' : 'badge pendiente';
                    const badgeText = d.EstadoTransferencia === 'Aprobada' ? 'APROBADA' : 'PENDIENTE';
                    listDonaciones.innerHTML += `
                        <tr>
                            <td>${d.Fecha}</td>
                            <td><b>${sanitizeText(d.NombreDonante)}</b><br><small>${sanitizeText(d.CorreoDonante)}</small></td>
                            <td><b style="color:var(--terracota)">$${Number(d.Monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b></td>
                            <td><span class="${badgeClass}">${badgeText}</span></td>
                        </tr>
                    `;
                });
            }
        }

        // Cargar lista de distribuciones
        const listDistribuciones = document.getElementById('lista-distribuciones');
        if (listDistribuciones) {
            listDistribuciones.innerHTML = '';
            if (data.distribuciones.length === 0) {
                listDistribuciones.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted); padding: 15px;">No hay asignaciones registradas.</td></tr>';
            } else {
                data.distribuciones.forEach(dist => {
                    listDistribuciones.innerHTML += `
                        <tr>
                            <td>${dist.Fecha}</td>
                            <td><b>${sanitizeText(dist.PacienteNombre)}</b></td>
                            <td><b style="color:#2A9D8F">$${Number(dist.Monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b></td>
                        </tr>
                    `;
                });
            }
        }

        // Cargar pacientes para el dropdown
        const pRes = await fetch('http://localhost:3000/pacientes');
        if (!pRes.ok) throw new Error("Falla cargando pacientes");
        let pacientes = await pRes.json();
        pacientes = pacientes.map(sanitizePatient);

        const selectPaciente = document.getElementById('distribuir-paciente-id');
        if (selectPaciente) {
            selectPaciente.innerHTML = '<option value="">Selecciona paciente...</option>';
            pacientes.forEach(p => {
                const clabeSnippet = p.clabe ? ` | Tarjeta: ${formatAdminCard(p.clabe)}` : ' | ⚠️ Sin tarjeta';
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.nombre} (ID: ${p.id}${clabeSnippet})`;
                
                // Guardar atributos para uso rápido en JS
                opt.setAttribute('data-clabe', p.clabe || '');
                opt.setAttribute('data-tutor', p.tutor?.nombre || p.tutorNombre || '');
                opt.setAttribute('data-tel', p.tutor?.telefono || p.telefono || '');
                opt.setAttribute('data-pacname', p.nombre);
                selectPaciente.appendChild(opt);
            });
        }

    } catch (err) {
        console.error("Error al cargar fondo general:", err);
    }
}

// Escuchar envío del formulario de distribución
document.getElementById('distribuirForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('distribuir-paciente-id').value;
    const monto = document.getElementById('distribuir-monto').value;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Distribuyendo fondos...';

    try {
        const res = await fetch('http://localhost:3000/admin/fondo-general/distribuir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pacienteId, monto })
        });
        const result = await res.json();
        if (res.ok && result.success) {
            const select = document.getElementById('distribuir-paciente-id');
            const opt = select.options[select.selectedIndex];
            const tutor = opt.getAttribute('data-tutor');
            const tel = opt.getAttribute('data-tel');
            const pacName = opt.getAttribute('data-pacname');

            // Abrir WhatsApp automáticamente si hay teléfono registrado
            if (tel) {
                enviarWhatsAppTransferencia(tutor, tel, pacName, monto);
            } else {
                alert('✅ ¡Fondos asignados con éxito! (El paciente no tiene teléfono registrado para notificación.)');
            }

            e.target.reset();
            const infoDiv = document.getElementById('distribuir-paciente-clabe-info');
            if (infoDiv) infoDiv.style.display = 'none';
            loadFondoGeneral();
        } else {
            alert('❌ Error: ' + (result.error || 'Desconocido'));
        }
    } catch (error) {
        console.error(error);
        alert('❌ Error de conexión al distribuir fondos.');
    } finally {
        btn.disabled = false; btn.textContent = 'Confirmar Distribución 💸';
    }
});

async function loadEvidencias() {
    const list = document.getElementById('lista-evidencias');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando comprobantes...</td></tr>';

    try {
        const res = await fetch('http://localhost:3000/admin/evidencias');
        let data = await res.json();
        data = data.map(ev => {
            const cleanEv = { ...ev };
            if (cleanEv.PacienteNombre) cleanEv.PacienteNombre = sanitizeText(cleanEv.PacienteNombre);
            if (cleanEv.Descripcion) cleanEv.Descripcion = sanitizeText(cleanEv.Descripcion);
            return cleanEv;
        });
        list.innerHTML = '';

        if(data.length === 0) {
            list.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding:30px;">No hay comprobantes de gastos pendientes de verificar.</td></tr>`;
            return;
        }

        data.forEach(e => {
            list.innerHTML += `
              <tr>
                <td>
                  <div style="font-size:0.75rem; color:var(--text-light)">Paciente ID: ${e.PacienteID}</div>
                  <b>${e.PacienteNombre}</b>
                  <div style="font-size:0.75rem; color:var(--text-muted)">Fecha: ${e.Fecha}</div>
                </td>
                <td>${e.Descripcion}</td>
                <td><b style="color:var(--terracota)">$${Number(e.MontoComprobado).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b></td>
                <td>
                  <a href="http://localhost:3000/uploads/${e.RutaArchivo}" target="_blank" class="action-btn" style="border-color:var(--gold);color:var(--gold);text-decoration:none;display:inline-block;margin-top:2px;">
                    📄 Ver Comprobante
                  </a>
                </td>
                <td style="display:flex;gap:6px;align-items:center;">
                  <button class="action-btn" style="border-color:#2A9D8F;color:#2A9D8F;" onclick="validarEvidencia(${e.EvidenciaID}, 'Aprobada')">✅ Aprobar</button>
                  <button class="action-btn" style="border-color:#b91c1c;color:#b91c1c;" onclick="validarEvidencia(${e.EvidenciaID}, 'Rechazada')">✕ Rechazar</button>
                </td>
              </tr>
            `;
        });
    } catch (err) {
        console.error(err);
        list.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--terracota);">Error al cargar comprobantes de gastos.</td></tr>`;
    }
}

window.validarEvidencia = async (id, estado) => {
    const confirmMsg = estado === 'Aprobada' 
        ? '¿Confirmas que deseas aprobar este comprobante de gasto? Se mostrará en el perfil público del paciente.' 
        : '¿Deseas rechazar este comprobante de gasto?';
    
    if(!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`http://localhost:3000/admin/evidencias/${id}/estado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        if(res.ok) {
            loadEvidencias();
        } else {
            alert('Error al actualizar el estado del comprobante');
        }
    } catch (err) {
        console.error(err);
    }
};

// =====================================================================
// 💳 UTILERÍAS PARA TARJETA BANCARIA Y NOTIFICACIONES DE WHATSAPP
// =====================================================================

// Helper: formato visual para número de tarjeta (grupos de 4)
function formatAdminCard(num) {
    const digits = String(num).replace(/\D/g, '');
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

window.copiarCLABE = (clabe) => {
    if (!clabe) return;
    navigator.clipboard.writeText(clabe).then(() => {
        alert('✅ Número de tarjeta copiado al portapapeles!');
    }).catch(err => {
        alert('No se pudo copiar: ' + err);
    });
};

window.enviarWhatsAppManual = (tutorNombre, telefono, pacienteNombre, monto, tipo) => {
    if (!telefono || telefono === '—') return alert("No hay teléfono registrado.");
    let cleanTel = telefono.replace(/\D/g, '');
    if (cleanTel.length === 10) {
        cleanTel = '52' + cleanTel; // Código de México
    }

    const formattedMonto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(monto));
    let msg = '';
    if (tipo === 'donacion') {
        msg = `Hola ${tutorNombre || 'Familiar'}. ¡Excelentes noticias! El caso de ${pacienteNombre} ha recibido y acreditado una donación por un monto de ${formattedMonto}. Los fondos serán transferidos a la tarjeta bancaria registrada a la brevedad. Atentamente, Asociación LATIR.`;
    } else if (tipo === 'distribucion') {
        msg = `Hola ${tutorNombre || 'Familiar'}. Se han asignado ${formattedMonto} desde el Fondo General LATIR al caso de ${pacienteNombre}. Los fondos se transferirán a la tarjeta bancaria registrada. ¡Seguimos de tu lado!`;
    } else {
        msg = `Hola ${tutorNombre || 'Familiar'}. Nos comunicamos de la Asociación LATIR con relación al caso de ${pacienteNombre}. Queremos confirmar los datos de tu tarjeta bancaria registrada.`;
    }

    const waUrl = `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
};

// Notificación automática de transferencia recibida (se dispara al confirmar distribución)
function enviarWhatsAppTransferencia(tutorNombre, telefono, pacienteNombre, monto) {
    if (!telefono || telefono === '—') return;
    let cleanTel = telefono.replace(/\D/g, '');
    if (cleanTel.length === 10) {
        cleanTel = '52' + cleanTel;
    }

    const formattedMonto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(monto));

    const msg =
        `✅ *Notificación LATIR*\n\n` +
        `Hola ${tutorNombre || 'Familiar'}, le informamos que el caso de *${pacienteNombre}* ha recibido una transferencia de *${formattedMonto}* por parte de la Asociación LATIR.\n\n` +
        `💳 El monto ha sido enviado a la tarjeta bancaria registrada en nuestro sistema.\n\n` +
        `Si tiene alguna duda, por favor comuníquese con nosotros.\n\n` +
        `_Asociación LATIR — Apoyando vidas_`;

    const waUrl = `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}

// Escuchar cambios en el selector de pacientes de distribución para mostrar tarjeta bancaria
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        document.getElementById('distribuir-paciente-id')?.addEventListener('change', (e) => {
            const select = e.target;
            const opt = select.options[select.selectedIndex];
            const infoDiv = document.getElementById('distribuir-paciente-clabe-info');
            if (!infoDiv) return;

            if (select.value && opt) {
                const clabe = opt.getAttribute('data-clabe');
                const tutor = opt.getAttribute('data-tutor');
                const tel = opt.getAttribute('data-tel');
                const pacName = opt.getAttribute('data-pacname');

                let html = `<strong>📋 Información de Transferencia:</strong><br>`;
                if (clabe) {
                    html += `<b>N° Tarjeta:</b> <code style="font-family: monospace; font-size:0.95rem; color:#2A9D8F;">${formatAdminCard(clabe)}</code> <button type="button" class="action-btn" style="padding: 1px 6px; font-size: 0.65rem;" onclick="copiarCLABE('${clabe}')">Copiar</button><br>`;
                } else {
                    html += `<span style="color:var(--terracota); font-weight:500;">⚠️ El paciente aún no registra número de tarjeta bancaria.</span><br>`;
                }
                if (tutor || tel) {
                    html += `<b>Contacto:</b> ${tutor || '—'} (${tel || '—'})`;
                    if (tel) {
                        html += ` <button type="button" class="action-btn" style="padding: 1px 6px; font-size: 0.65rem; border-color:#25D366; color:#25D366;" onclick="enviarWhatsAppManual('${tutor}', '${tel}', '${pacName}', '0', 'general')">💬 WA</button>`;
                    }
                }
                infoDiv.innerHTML = html;
                infoDiv.style.display = 'block';
            } else {
                infoDiv.style.display = 'none';
            }
        });
    }, 1000); // Dar un pequeño retraso para asegurar que los elementos estén renderizados
});
