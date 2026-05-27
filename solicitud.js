// =====================================================================
// LATIR — solicitud.js
// Protege el formulario de solicitud: solo pacientes autenticados
// pueden acceder y enviar su expediente clínico.
// =====================================================================

(function initSolicitud() {
  // ── 1. Verificar sesión de paciente ──────────────────────────────
  const paciente = LATIR_SESSION.proteger('paciente');
  if (!paciente) {
    // Redireccionado por proteger
    return;
  }

  // ── 2. Actualizar navbar dinámico ────────────────────────────────
  const navAuthDiv = document.getElementById('navAuthBtnsSol');
  if (navAuthDiv) {
    const inicial = paciente.nombre ? paciente.nombre.charAt(0).toUpperCase() : '?';
    navAuthDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#c0522a,#d4a24c);
             color:#fff;font-size:0.75rem;font-weight:700;display:flex;align-items:center;
             justify-content:center;border:2px solid rgba(255,255,255,0.6);">${inicial}</div>
        <span style="font-size:0.83rem;font-weight:600;color:#0f172a;">${paciente.nombre.split(' ')[0]}</span>
        <button onclick="cerrarSesionSolicitud()" style="font-size:0.75rem;color:#ef4444;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;font-family:inherit;">Cerrar sesión</button>
      </div>`;
  }

  // ── 4. Pre-llenar nombre del paciente e inyectar ID ──────────────
  const pacienteIdInput = document.getElementById('pacienteIdInput');
  if (pacienteIdInput) pacienteIdInput.value = paciente.id;

  // Pre-llenar nombre del paciente en el campo nombre si existe
  const nombreInput = document.querySelector('[name="nombre"]');
  if (nombreInput && paciente.nombre) nombreInput.value = paciente.nombre;

  // Mostrar banner de bienvenida
  const banner = document.getElementById('welcomeBanner');
  const welcomeMsg = document.getElementById('welcomeMsg');
  if (banner && welcomeMsg) {
    welcomeMsg.textContent = `Hola, ${paciente.nombre}. Llena los datos del paciente y tu información como tutor/familiar.`;
    banner.style.display = 'flex';
  }

  // ── 5. Envío del formulario ──────────────────────────────────────
  document.getElementById('solicitudForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando Datos a Trabajo Social...';

    // Asegurarse de que el pacienteId esté incluido
    const pidInput = document.getElementById('pacienteIdInput');
    if (pidInput) pidInput.value = paciente.id;

    const formData = new FormData(e.target);

    try {
      const res = await fetch('/solicitar', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (res.ok && result.success) {
        document.getElementById('solicitudForm').style.display = 'none';
        document.getElementById('successMsg').style.display = 'block';
        window.scrollTo(0, 0);
      } else {
        alert('❌ Error del servidor: ' + (result.error || 'Desconocido'));
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitud a Revisión';
      }
    } catch (error) {
      console.error(error);
      alert('❌ Error de conexión. Verifica que el servidor Node.js esté corriendo.');
      btn.disabled = false;
      btn.textContent = 'Enviar Solicitud a Revisión';
    }
  });
})();

// ── Cerrar sesión desde la página de solicitud ──────────────────────
function cerrarSesionSolicitud() {
  LATIR_SESSION.limpiarTodo();
  window.location.href = 'auth.html?role=paciente';
}
