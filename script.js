/* ============================================================
   LATIR — Lucha y Apoyo Transparente para Pacientes
   Hospitalizados | app.js (CONECTADO A BACKEND)
   ============================================================ */

// ── Limpieza de sesión legacy: eliminada para permitir compatibilidad local y fallback de almacenamiento.
// localStorage.removeItem('pacienteSession');

// ===== DATOS DE PACIENTES =====
let pacientesUrgencias = [];

// Tarjeta única de urgencias (botón de acceso a la lista)
const causasData = [
  {
    id: 1,
    titulo: "Pacientes en Urgencias",
    desc: "Casos activos en el área de urgencias del Hospital Dr. Carlos Canseco verificados por personal médico.",
    emoji: "🚨",
    categoria: "urgencias",
    bgColor: "#fdeaea",
    catLabel: "Urgencias",
    catColor: "#c0522a",
    catBg: "rgba(192,82,42,0.1)",
    meta: 0,
    recaudado: 0,
    donantes: 0,
    ig: 0,
  },
];

// ===== ESTADO GLOBAL =====
const state = {
  filtroActivo: "todas",
  modalAbierto: false,
  pasoActual: 1,
  montoSeleccionado: 200,
  causaSeleccionada: null,
  metodoPago: "transferencia",
  donorName: "",
  donorEmail: "",
  donorOcupacion: "",
  esRecurrente: false,
  donanteId: null,   // ⭐ ID del donante registrado
};

// ===== SESIÓN DE USUARIO (Navbar Dinámico) =====
function getDonante() {
  return LATIR_SESSION.leer('latir_donante');
}

function getPaciente() {
  return LATIR_SESSION.leer('pacienteSession');
}

function getAdmin() {
  return LATIR_SESSION.leer('latir_user');
}

function getSesionActiva() {
  const admin   = getAdmin();
  const donante = getDonante();
  const paciente = getPaciente();
  if (admin)   return { tipo: 'admin',   nombre: admin.nombre,    data: admin };
  if (donante) return { tipo: 'donante', nombre: donante.nombre,  data: donante };
  if (paciente) return { tipo: 'paciente', nombre: paciente.nombre, data: paciente };
  return null;
}

function actualizarNavbarSesion() {
  const sesion = getSesionActiva();
  const navAuthBtns = document.getElementById('navAuthBtns');
  const navUserChip = document.getElementById('navUserChip');

  if (!navAuthBtns || !navUserChip) return;

  if (sesion) {
    // Ocultar botones de auth, mostrar chip de usuario
    navAuthBtns.style.display = 'none';
    navUserChip.classList.add('visible');

    // Inicial del nombre para el avatar
    const inicial = sesion.nombre ? sesion.nombre.charAt(0).toUpperCase() : '?';
    document.getElementById('userAvatar').textContent = inicial;
    document.getElementById('userNameBtn').childNodes[0].textContent = sesion.nombre.split(' ')[0] + ' ';

    // Tipo de rol en el dropdown
    const roles = { admin: '🔒 Administrador', donante: '💝 Donante', paciente: '🏥 Paciente/Tutor' };
    document.getElementById('dropdownRole').textContent = roles[sesion.tipo] || sesion.tipo;
    document.getElementById('dropdownName').textContent = sesion.nombre;

    // Dashboard link según rol
    const dashLinks = { admin: 'admin.html', donante: 'dashboard-donante.html', paciente: 'dashboard-paciente.html' };
    const dashIcons = { admin: '⚙️ Panel Admin', donante: '📊 Mis Donaciones', paciente: '🏥 Mi Dashboard' };
    const dashEl = document.getElementById('dropdownDashboard');
    dashEl.href = dashLinks[sesion.tipo];
    dashEl.textContent = dashIcons[sesion.tipo];

    // Guardar donanteId en el estado si es donante
    if (sesion.tipo === 'donante') {
      state.donanteId = sesion.data.id;
    }
  } else {
    // Mostrar botones de auth, ocultar chip
    navAuthBtns.style.display = 'flex';
    navUserChip.classList.remove('visible');
  }
}

function toggleUserDropdown() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.classList.toggle('open');
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
  const chip = document.getElementById('navUserChip');
  if (chip && !chip.contains(e.target)) {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('open');
  }
});

function cerrarSesion() {
  LATIR_SESSION.limpiarTodo();
  state.donanteId = null;
  actualizarNavbarSesion();
  // Reload limpio
  window.location.reload();
}

// Alias para compatibilidad
function actualizarNavbarDonante() {
  actualizarNavbarSesion();
}


// ===== UTILIDADES =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatMoney(num) {
  return "$" + num.toLocaleString("es-MX");
}

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

function pct(recaudado, meta) {
  if (!meta) return 0;
  return Math.min(Math.round((recaudado / meta) * 100), 100);
}

function igClase(ig) {
  if (!ig) return "";
  if (ig <= 2) return "ig-bajo";
  if (ig <= 4) return "ig-medio";
  if (ig <= 6) return "ig-urgente";
  return "ig-critico";
}

function igTexto(ig) {
  if (!ig) return "";
  if (ig <= 2) return "Seguimiento";
  if (ig <= 4) return "Moderado";
  if (ig <= 6) return "Urgente";
  if (ig <= 8) return "Crítico";
  return "Emergencia";
}

// ===== CARGAR PACIENTES DESDE EL BACKEND =====
async function cargarPacientes() {
  try {
    const res = await fetch('/pacientes');
    if (!res.ok) throw new Error("Error en servidor");
    
    const data = await res.json();
    pacientesUrgencias = data.map(p => {
      const cleanP = { ...p };
      if (cleanP.nombre) cleanP.nombre = sanitizeText(cleanP.nombre);
      if (cleanP.area) cleanP.area = sanitizeText(cleanP.area);
      if (cleanP.diagnostico) cleanP.diagnostico = sanitizeText(cleanP.diagnostico);
      if (cleanP.necesidad) cleanP.necesidad = sanitizeText(cleanP.necesidad);
      if (cleanP.triage) cleanP.triage = sanitizeText(cleanP.triage);
      if (cleanP.sexo) cleanP.sexo = sanitizeText(cleanP.sexo);
      
      if (cleanP.tutor) {
        cleanP.tutor = { ...cleanP.tutor };
        if (cleanP.tutor.nombre) cleanP.tutor.nombre = sanitizeText(cleanP.tutor.nombre);
        if (cleanP.tutor.parentesco) cleanP.tutor.parentesco = sanitizeText(cleanP.tutor.parentesco);
        if (cleanP.tutor.municipio) cleanP.tutor.municipio = sanitizeText(cleanP.tutor.municipio);
        if (cleanP.tutor.nivelSocioeconomico) cleanP.tutor.nivelSocioeconomico = sanitizeText(cleanP.tutor.nivelSocioeconomico);
        if (cleanP.tutor.dependientes) cleanP.tutor.dependientes = sanitizeText(cleanP.tutor.dependientes);
      }
      return cleanP;
    });

    // Actualizamos las sumas en la tarjeta general de Urgencias
    let totalRecaudado = 0;
    let totalMeta = 0;
    let maxIg = 0;
    let totalDonantes = 0;

    pacientesUrgencias.forEach(p => {
        totalRecaudado += Number(p.recaudado);
        totalMeta += Number(p.meta);
        totalDonantes += Number(p.donantes);
        if (p.ig > maxIg) maxIg = p.ig;
    });

    causasData[0].recaudado = totalRecaudado;
    causasData[0].meta = totalMeta;
    causasData[0].donantes = totalDonantes;
    causasData[0].ig = maxIg;

    // Renderizamos la tarjeta del hero/home
    generarCausas('urgencias');
    
    // Si la lista está abierta, la actualizamos
    if($("#vistaLista").style.display !== "none") {
        renderListaPacientes(pacientesUrgencias);
    }
  } catch (error) {
    console.error("Error cargando pacientes:", error);
    
    // FALLBACK visual para no romper la web si el backend está inactivo
    document.getElementById("causasGrid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#c0522a;background:#fff5f2;border-radius:12px;">
        <span style="font-size:2rem;">⚠️</span>
        <h4>No se pudo conectar al servidor</h4>
        <p>Asegúrate de que el backend en Node.js está corriendo.</p>
      </div>
    `;
  }
}

// ===== FUNCIONAMIENTO DE INTERFAZ =====

// Navbar Scroll
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if(nav) nav.classList.toggle("scrolled", window.scrollY > 20);
});

// Menú Móvil
const hamburger = document.querySelector(".hamburger");
const navLinks = document.querySelector(".nav-links");

if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navLinks.classList.toggle("active");
  });
  
  navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
          hamburger.classList.remove("active");
          navLinks.classList.remove("active");
      });
  });
}

// Contadores animados
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  if (!target) return;
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  const duration = 1800;
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = prefix + current.toLocaleString("es-MX") + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const observerCounters = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observerCounters.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll(".stat-num[data-target]").forEach((el) => {
  observerCounters.observe(el);
});

// ===== CARDS =====
function generarCausas(filtro = "todas") {
  const grid = $("#causasGrid");
  if(!grid) return;
  
  const filtradas =
    filtro === "todas"
      ? causasData
      : causasData.filter((c) => c.categoria === filtro);

  grid.innerHTML = "";

  if (filtradas.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
      <div style="font-size:2.5rem;margin-bottom:12px;">🏥</div>
      <p>No hay casos activos en esta categoría por el momento.</p>
    </div>`;
    return;
  }

  filtradas.forEach((causa, i) => {
    const porcentaje = pct(causa.recaudado, causa.meta);
    const tieneIG = causa.ig > 0;
    const igClass = tieneIG ? igClase(causa.ig) : "";
    const igLabel = tieneIG ? igTexto(causa.ig) : "Pendiente";

    const card = document.createElement("div");
    card.className = "causa-card";
    card.style.animationDelay = `${i * 0.08}s`;

    card.innerHTML = `
      <div class="causa-image" style="background:${causa.bgColor}">
        ${causa.emoji}
        <div style="position:absolute;top:12px;left:12px;">
          <span class="ig-badge ${igClass}">
            📊 IG: ${tieneIG ? causa.ig : "—"} · ${igLabel}
          </span>
        </div>
      </div>
      <div class="causa-body">
        <span class="causa-cat" style="color:${causa.catColor};background:${causa.catBg}">${causa.catLabel}</span>
        <h3 class="causa-title">${causa.titulo}</h3>
        <p class="causa-desc">${causa.desc}</p>
        <div class="causa-progress-wrap">
          <div class="causa-progress-info" style="justify-content: center;">
            <span style="font-size: 1.05rem;"><strong>${formatMoney(causa.recaudado)}</strong> recaudados en total</span>
          </div>
        </div>
        <div class="causa-footer">
          <span class="causa-donantes">👤 ${causa.donantes.toLocaleString("es-MX")} donantes en total</span>
          <button class="btn-donar-card" data-id="${causa.id}">Apoyar Casos</button>
        </div>
      </div>
    `;

    grid.appendChild(card);

    setTimeout(() => {
      const fill = card.querySelector(".progress-fill");
      if(fill) fill.style.width = fill.dataset.width;
    }, 100 + i * 80);

    card.querySelector(".btn-donar-card").addEventListener("click", (e) => {
      e.stopPropagation();
      abrirListaPacientes();
    });
  });
}

// ===== LISTA DE PACIENTES =====
let pacienteSeleccionado = null;

function abrirListaPacientes() {
  if (pacientesUrgencias.length === 0) {
      alert("En este momento no hay pacientes registrados o no se pudo cargar la base de datos.");
      return;
  }
  renderListaPacientes(pacientesUrgencias);
  const overlay = document.getElementById("perfilOverlay");
  if(overlay) {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function cerrarPerfilModal() {
  const overlay = document.getElementById("perfilOverlay");
  if(!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  pacienteSeleccionado = null;
  document.getElementById("vistaLista").style.display = "block";
  document.getElementById("vistaDetalle").style.display = "none";
}

function igColorClass(ig) {
  if (!ig) return "ig-bajo";
  if (ig <= 2) return "ig-bajo";
  if (ig <= 4) return "ig-medio";
  if (ig <= 6) return "ig-urgente";
  return "ig-critico";
}

function renderListaPacientes(lista) {
  const cont = document.getElementById("listaPacientesCont");
  if(!cont) return;
  cont.innerHTML = "";
  
  if (lista.length === 0) {
      cont.innerHTML = "<p style='text-align:center;padding:20px;'>No hay resultados para tu búsqueda.</p>";
      return;
  }

  lista.forEach(p => {
    const item = document.createElement("div");
    item.className = "lista-paciente-item";
    item.style.cursor = "pointer";
    item.dataset.id = p.id;
    item.innerHTML = `
      <div class="lp-left">
        <div class="lp-avatar">${p.sexo === "Femenino" ? "👩" : "👨"}</div>
        <div class="lp-info">
          <span class="lp-nombre">${p.nombre}</span>
          <span class="lp-detalle">${p.edad} años - ${p.area}</span>
          <span class="lp-diagnostico">${p.diagnostico}</span>
          <div style="font-size:0.75rem; color:var(--terracota); margin-top:2px;">Recaudado: ${formatMoney(p.recaudado)}</div>
        </div>
      </div>
      <div class="lp-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
        <span class="ig-badge ${igColorClass(p.ig)}">IG ${p.ig} - ${igTexto(p.ig)}</span>
        <span class="lp-triage">${p.triage}</span>
        <button class="action-btn" style="font-size:0.75rem; padding:4px 10px; border-color:var(--terracota); color:var(--terracota); background:transparent; border-radius:50px; cursor:pointer;">Ver perfil →</button>
      </div>
    `;
    // Hacer todo el item clickeable
    item.addEventListener("click", () => {
      const pac = pacientesUrgencias.find(px => String(px.id) === String(item.dataset.id));
      if (pac) abrirDetallePaciente(pac);
    });
    cont.appendChild(item);
  });
}

function abrirDetallePaciente(pac) {
  if (!pac) { console.warn('Paciente no encontrado'); return; }
  pacienteSeleccionado = pac;

  try {
    // Avatar dinámico
    const avatarEl = document.getElementById("det-avatar");
    if (avatarEl) avatarEl.textContent = pac.sexo === "Femenino" ? "👩" : "👨";

    document.getElementById("det-nombre").textContent    = pac.nombre || '—';
    document.getElementById("det-edad").textContent      = `${pac.edad || '—'} años · ${pac.sexo || '—'}`;
    document.getElementById("det-area").textContent      = pac.area || '—';
    document.getElementById("det-triage").textContent    = pac.triage || '—';
    document.getElementById("det-diagnostico").textContent = pac.diagnostico || '—';
    document.getElementById("det-fecha").textContent     = pac.fechaIngreso || '—';
    document.getElementById("det-necesidad").textContent = pac.necesidad || '—';
    document.getElementById("det-ig").innerHTML          =
      `<span>\ud83d\udcca</span> <span>Indice de Gravedad: <strong>IG ${pac.ig || 0} — ${igTexto(pac.ig)}</strong></span>`;

    // Recaudado
    const recEl = document.getElementById("det-recaudado");
    if (recEl) recEl.textContent = formatMoney(pac.recaudado || 0);

    // Evidencias / Comprobantes de Gastos (Carga Dinámica en Tiempo Real)
    const galeria = document.getElementById("det-evidencias-galeria");
    if (galeria) {
      galeria.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); margin:0; text-align:center;">Cargando comprobantes...</p>`;
      
      fetch(`/pacientes/${pac.id}/evidencias`)
        .then(res => res.json())
        .then(data => {
          galeria.innerHTML = "";
          
          // Filtrar solo comprobantes aprobados por el administrador
          const aprobadas = data.filter(e => e.Estado === 'Aprobada');
          
          if (aprobadas.length === 0) {
            galeria.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); margin:0; text-align:center;">No hay comprobantes de gastos autorizados aún.</p>`;
          } else {
            aprobadas.forEach(ev => {
              const isPdf = ev.RutaArchivo.toLowerCase().endsWith(".pdf");
              let previewHtml = "";
              if (isPdf) {
                previewHtml = `<span style="font-size: 1.5rem; margin-right: 8px;">📄</span>`;
              } else {
                previewHtml = `<img src="/uploads/${ev.RutaArchivo}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; margin-right:8px;" alt="Comprobante" />`;
              }

              galeria.innerHTML += `
                <div style="display:flex; align-items:center; background:#fff; padding:10px; border-radius:8px; border:1px solid var(--border); margin-bottom: 8px;">
                  ${previewHtml}
                  <div style="flex:1; text-align:left; min-width:0;">
                    <p style="font-size:0.82rem; font-weight:700; color:var(--brown-dark); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sanitizeText(ev.Descripcion)}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">${ev.Fecha} · <b style="color:var(--terracota); font-weight:700;">$${Number(ev.MontoComprobado).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b></p>
                  </div>
                  <a href="/uploads/${ev.RutaArchivo}" target="_blank" style="font-size:0.75rem; color:var(--terracota); text-decoration:underline; margin-left:10px; flex-shrink:0;">
                    Ver Archivo
                  </a>
                </div>
              `;
            });
          }
        })
        .catch(err => {
          console.error("Error al obtener evidencias:", err);
          galeria.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); margin:0; text-align:center;">No se pudieron cargar los comprobantes autorizados.</p>`;
        });
    }

  } catch(err) {
    console.error('Error mostrando detalle paciente:', err);
  }

  document.getElementById("vistaLista").style.display   = "none";
  document.getElementById("vistaDetalle").style.display = "block";
}

if($("#perfilClose")) $("#perfilClose").addEventListener("click", cerrarPerfilModal);
if($("#perfilOverlay")) {
    $("#perfilOverlay").addEventListener("click", (e) => {
        if (e.target === document.getElementById("perfilOverlay")) cerrarPerfilModal();
    });
}
if($("#btnVolverLista")) {
    $("#btnVolverLista").addEventListener("click", () => {
        document.getElementById("vistaLista").style.display   = "block";
        document.getElementById("vistaDetalle").style.display = "none";
        pacienteSeleccionado = null;
    });
}
if($("#btnVolverLista2")) {
    $("#btnVolverLista2").addEventListener("click", () => {
        document.getElementById("vistaLista").style.display   = "block";
        document.getElementById("vistaDetalle").style.display = "none";
        pacienteSeleccionado = null;
    });
}

// Buscador en lista
if($("#buscadorPaciente")) {
    $("#buscadorPaciente").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtrados = q
            ? pacientesUrgencias.filter(p =>
                p.nombre.toLowerCase().includes(q) ||
                p.diagnostico.toLowerCase().includes(q)
            )
            : pacientesUrgencias;
        renderListaPacientes(filtrados);
    });
}

if($("#btnDonarPaciente")) {
    $("#btnDonarPaciente").addEventListener("click", () => {
        cerrarPerfilModal();
        setTimeout(() => abrirModal(pacienteSeleccionado), 200);
    });
}


// ===== MODAL =====
function abrirModal(pacienteSeleccionado = null) {
  // ⭐ GUARDIA: verificar sesión de donante
  const donante = getDonante();
  if (!donante) {
    // Guardar intención de donación para recuperarla después de login
    const redirectPayload = JSON.stringify({ pacienteId: pacienteSeleccionado?.id || null });
    try { sessionStorage.setItem('latir_redirect_donacion', redirectPayload); } catch(e){}
    try { localStorage.setItem('latir_redirect_donacion', redirectPayload); } catch(e){}
    showToast('Para donar primero debes registrarte o iniciar sesión ♡');
    setTimeout(() => { window.location.href = 'registro-donante.html'; }, 1800);
    return;
  }

  // Pre-llenar datos del donante
  state.donanteId   = donante.id;
  state.donorName   = donante.nombre   || '';
  state.donorEmail  = donante.correo   || '';
  state.donorOcupacion = donante.ocupacion || '';

  state.causaSeleccionada = pacienteSeleccionado;
  state.pasoActual = 1;
  state.montoSeleccionado = 200;
  resetModal();

  if (pacienteSeleccionado) {
    $("#modalTitle").textContent = pacienteSeleccionado.nombre;
    $("#modalCausa").textContent = `Urgencias · Hospital "Dr. Carlos Canseco"`;

    const igBox = $("#igInfoBox");
    if (pacienteSeleccionado.ig > 0) {
      igBox.style.display = "flex";
      igBox.innerHTML = `<span>📊</span> <span>Este caso tiene <strong>Índice de Gravedad ${pacienteSeleccionado.ig} — ${igTexto(pacienteSeleccionado.ig)}</strong>. Tu apoyo es prioritario.</span>`;
    } else {
      igBox.style.display = "none";
    }
  } else {
    $("#modalTitle").textContent = "Apoyo General LATIR";
    $("#modalCausa").textContent = 'Hospital "Dr. Carlos Canseco"';
    $("#igInfoBox").style.display = "none";
  }

  // Pre-llenar el paso 2 con los datos del donante
  if ($("#donorName"))  $("#donorName").value  = state.donorName;
  if ($("#donorEmail")) $("#donorEmail").value = state.donorEmail;
  if ($("#donorOcupacion") && donante.ocupacion) {
    // Intentar seleccionar la opción que coincida
    const opts = $("#donorOcupacion").options;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].value.toLowerCase() === (donante.ocupacion || '').toLowerCase()) {
        $("#donorOcupacion").selectedIndex = i;
        break;
      }
    }
  }

  $("#modalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  state.modalAbierto = true;
}


function cerrarModal() {
  $("#modalOverlay").classList.remove("open");
  document.body.style.overflow = "";
  state.modalAbierto = false;
  $(".modal-progress").style.opacity = "1";
}

function resetModal() {
  $$(".modal-step").forEach((s) => s.classList.remove("active"));
  $("#step1").classList.add("active");
  $$(".amount-btn").forEach((b) => {
    b.classList.toggle("selected", parseInt(b.dataset.amount) === 200);
  });
  actualizarProgress(1);
  if ($("#donorName")) $("#donorName").value = "";
  if ($("#donorEmail")) $("#donorEmail").value = "";
  if ($("#donorOcupacion")) $("#donorOcupacion").value = "";
  if ($("#customAmount")) $("#customAmount").value = "";
  if ($("#recurrente")) $("#recurrente").checked = false;
  state.montoSeleccionado = 200;
  state.esRecurrente = false;
  // Solo existe un método (transferencia), asegurar que esté seleccionado
  $$(".pay-btn").forEach((b) => b.classList.toggle("selected", b.dataset.pay === "transferencia"));
  state.metodoPago = "transferencia";
}

function irAPaso(paso) {
  $$(".modal-step").forEach((s) => s.classList.remove("active"));
  $(`#step${paso}`).classList.add("active");
  state.pasoActual = paso;
  actualizarProgress(paso);
}

function actualizarProgress(paso) {
  $$(".progress-step").forEach((s, i) => {
    const num = i + 1;
    s.classList.remove("active", "done");
    if (num < paso) s.classList.add("done");
    else if (num === paso) s.classList.add("active");
  });
}

["btnDonarHero", "btnDonarCta"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => {
    // Si ya hay sesión de donante activa, abrir modal directamente
    if (getDonante()) {
      abrirModal();
    } else {
      // Si no hay sesión, redirigir al login
      window.location.href = "auth.html?tab=login";
    }
  });
});

if($("#modalClose")) $("#modalClose").addEventListener("click", cerrarModal);
if($("#btnClose")) $("#btnClose").addEventListener("click", cerrarModal);
if($("#modalOverlay")) {
    $("#modalOverlay").addEventListener("click", (e) => {
        if (e.target === $("#modalOverlay")) cerrarModal();
    });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.modalAbierto) cerrarModal();
});

// Mensajes y Selecciones
$$(".amount-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".amount-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.montoSeleccionado = parseInt(btn.dataset.amount);
    if ($("#customAmount")) $("#customAmount").value = "";
  });
});

if($("#customAmount")){
    $("#customAmount").addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    if (val > 0) {
        $$(".amount-btn").forEach((b) => b.classList.remove("selected"));
        state.montoSeleccionado = val;
    }
    });
}
if($("#recurrente")) {
    $("#recurrente").addEventListener("change", (e) => {
        state.esRecurrente = e.target.checked;
    });
}

// Paso 1 -> 2
if($("#btnStep1")) {
    $("#btnStep1").addEventListener("click", () => {
        const customVal = parseInt($("#customAmount").value);
        if (customVal > 0) state.montoSeleccionado = customVal;
        if (!state.montoSeleccionado || state.montoSeleccionado < 10) {
            showToast("Por favor selecciona o ingresa un monto válido (mínimo $10)");
            return;
        }
        irAPaso(2);
    });
}

// Medio de pago
$$(".pay-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".pay-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.metodoPago = btn.dataset.pay;
  });
});

// Paso 2 -> 3
if($("#btnStep2")){
    $("#btnStep2").addEventListener("click", () => {
    const nombre = $("#donorName").value.trim();
    const email = $("#donorEmail").value.trim();
    if (!nombre) { showToast("Por favor ingresa tu nombre completo"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Por favor ingresa un correo electrónico válido"); return;
    }
    state.donorName = nombre;
    state.donorEmail = email;
    state.donorOcupacion = $("#donorOcupacion").value;
    mostrarResumen();
    irAPaso(3);
    });
}

function mostrarResumen() {
  const nomPaciente = state.causaSeleccionada
    ? state.causaSeleccionada.nombre
    : "Fondo General LATIR";

  const ocupacionLabel = state.donorOcupacion
    ? ` <strong>${state.donorOcupacion}</strong>` : "";

  $("#confirmSummary").innerHTML = `
    <div style="display:grid;gap:8px;">
      <div style="display:flex;justify-content:space-between;">
        <span>Paciente / Caso</span>
        <strong>${nomPaciente}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>Donación</span>
        <strong style="color:var(--terracota);font-size:1.05rem;">${formatMoney(state.montoSeleccionado)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>Donante</span>
        <strong>${state.donorName}${ocupacionLabel}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>Correo</span>
        <strong>${state.donorEmail}</strong>
      </div>
      ${state.esRecurrente ? '<div style="color:var(--sage);font-size:0.8rem;font-weight:500;text-align:center;padding-top:4px;">🔄 Aportación mensual recurrente activada</div>' : ""}
    </div>
  `;

  // Llenar los campos dinámicos en la caja de datos bancarios
  const conceptoEl = $("#concepto-transferencia");
  const montoEl    = $("#monto-transferencia");
  if (conceptoEl) conceptoEl.textContent = nomPaciente.toUpperCase();
  if (montoEl)    montoEl.textContent    = formatMoney(state.montoSeleccionado);
}

if($("#btnBack1")) $("#btnBack1").addEventListener("click", () => irAPaso(1));
if($("#btnBack2")) $("#btnBack2").addEventListener("click", () => irAPaso(2));

// ===== FINALIZAR DONACIÓN CON INTEGRACIÓN A BACKEND =====
if($("#btnConfirm")) {
    $("#btnConfirm").addEventListener("click", async () => {
        const btn = $("#btnConfirm");
        btn.disabled = true;
        btn.textContent = "Procesando de forma segura...";
        
        try {
            // 1. Mandar datos de donación a la API
            const bodyData = {
                pacienteId: state.causaSeleccionada ? state.causaSeleccionada.id : null,
                monto:      state.montoSeleccionado,
                nombre:     state.donorName,
                correo:     state.donorEmail,
                metodo:     state.metodoPago,
                recurrente: state.esRecurrente,
                ocupacion:  state.donorOcupacion,
                donanteId:  state.donanteId,   // ⭐ vincular con cuenta registrada
            };

            const response = await fetch('/donar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if(!response.ok) throw new Error("Error registrando donación.");
            
            // 2. Si es exitoso, pasamos al paso 4 (Éxito)
            irAPaso(4);
            $(".modal-progress").style.opacity = "0";
            lanzarConfetti();

            // 3. Opcional: Recargar los pacientes y estadísticas pacíficamente en el fondo
            cargarPacientes();
            cargarEstadisticas();
            
        } catch (error) {
            console.error(error);
            showToast("Hubo un error de conexión procesando la donación.");
        } finally {
            btn.disabled = false;
            btn.textContent = "✅ Confirmar Transferencia";
        }
    });
}

// ===== TOAST =====
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed;bottom:32px;left:50%;
      transform:translateX(-50%) translateY(20px);
      background:var(--brown-dark);color:#fff;
      padding:12px 24px;border-radius:50px;
      font-family:'DM Sans',sans-serif;font-size:0.85rem;
      z-index:999;opacity:0;transition:all 0.3s;
      max-width:90vw;text-align:center;
      box-shadow:0 8px 32px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 3000);
}

// ===== CONFETTI =====
function lanzarConfetti() {
  const colores = ["#c0522a", "#d4a24c", "#7a9e7e", "#faf6f1", "#e87a52"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    const color = colores[Math.floor(Math.random() * colores.length)];
    const size = Math.random() * 8 + 4;
    p.style.cssText = `
      position:fixed;top:${Math.random() * -20}px;
      left:${Math.random() * window.innerWidth}px;
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      z-index:9999;pointer-events:none;
      animation:confettiFall ${1.5 + Math.random() * 1.5}s ease-in ${Math.random() * 0.8}s forwards;
      transform:rotate(${Math.random() * 360}deg);
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3500);
  }
  if (!document.getElementById("confettiStyle")) {
    const s = document.createElement("style");
    s.id = "confettiStyle";
    s.textContent = `@keyframes confettiFall {
      0%   { transform:translateY(0) rotate(0deg); opacity:1; }
      100% { transform:translateY(100vh) rotate(720deg); opacity:0; }
    }`;
    document.head.appendChild(s);
  }
}

// Animaciones Entrada
const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
        if (!entry.target || !entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        fadeObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.1 }
);

function applyFadeIn(selector) {
  $$(selector).forEach((el, i) => {
    el.style.cssText += `
      opacity:0;transform:translateY(28px);
      transition:opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s;
    `;
    fadeObserver.observe(el);
  });
}

applyFadeIn(".step");
applyFadeIn(".metric-card");
applyFadeIn(".impacto-item");
applyFadeIn(".ig-card");

// ===== INICIALIZAR APP =====
cargarPacientes();
cargarEstadisticas();

async function cargarEstadisticas() {
  try {
    const res = await fetch('/estadisticas');
    if (!res.ok) throw new Error("Error obteniendo estadisticas");
    const data = await res.json();
    if (!data.success) return;

    // 1. Actualizar Hero Stats
    const heroStats = document.querySelectorAll('.hero-stats .stat');
    if (heroStats.length >= 3) {
      // Donantes activos
      const donantesNum = heroStats[0].querySelector('.stat-num');
      if (donantesNum) {
        donantesNum.dataset.target = data.totalDonantes;
        animateCounter(donantesNum);
      }
      
      // Recaudados este mes
      const recaudadoNum = heroStats[1].querySelector('.stat-num');
      if (recaudadoNum) {
        recaudadoNum.dataset.suffix = ""; // Mostrar el monto exacto
        recaudadoNum.dataset.target = data.totalRecaudado;
        animateCounter(recaudadoNum);
      }
    }

    // 2. Actualizar Seccion de Transparencia (Impacto)
    const metricCards = document.querySelectorAll('.impacto-metrics .metric-card');
    if (metricCards.length >= 3) {
      // Total recaudado
      const totalRecaudadoEl = metricCards[0].querySelector('.metric-num');
      if (totalRecaudadoEl) {
        totalRecaudadoEl.textContent = `$${Number(data.totalRecaudado).toLocaleString('es-MX')}`;
      }

      // Pacientes apoyados
      const apoyadosEl = metricCards[1].querySelector('.metric-num');
      if (apoyadosEl) {
        apoyadosEl.textContent = data.pacientesApoyados;
      }

      // Casos verificados
      const verificadosEl = metricCards[2].querySelector('.metric-num');
      if (verificadosEl) {
        verificadosEl.textContent = data.casosVerificados;
      }
    }
  } catch (error) {
    console.error("Error al cargar estadisticas:", error);
  }
}

// ===== ACTUALIZACIÓN DE NAVBAR Y REDIRECCIÓN POST-LOGIN =====
document.addEventListener('DOMContentLoaded', () => {
  // Actualizar el enlace del navbar según sesión
  actualizarNavbarDonante();

  // Activar vigilancia pasiva de inactividad si hay sesión activa en la landing
  const sesion = getSesionActiva();
  if (sesion) {
    LATIR_SESSION.iniciarVigilancia(() => {
      LATIR_SESSION.limpiarTodo();
      window.location.reload();
    });
  }

  // Si viene de registro/login con intención de donar, abrir modal automáticamente
  let redirect = null;
  try { redirect = sessionStorage.getItem('latir_redirect_donacion') || localStorage.getItem('latir_redirect_donacion'); } catch(e){}
  if (redirect && getDonante()) {
    try { sessionStorage.removeItem('latir_redirect_donacion'); } catch(e){}
    try { localStorage.removeItem('latir_redirect_donacion'); } catch(e){}
    const data = JSON.parse(redirect);
    // Esperar a que carguen los pacientes
    setTimeout(() => {
      if (data.pacienteId) {
        const pac = pacientesUrgencias.find(p => p.id === data.pacienteId);
        if (pac) abrirModal(pac); else abrirListaPacientes();
      } else {
        abrirModal();
      }
    }, 1500);
  }
});