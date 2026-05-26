/* ============================================================
   LATIR — latir-session.js
   Gestor central de seguridad de sesiones.
   - Expiración dura: 2 horas desde el inicio de sesión.
   - Expiración por inactividad: 30 minutos sin interacción.
   - Protección por rol: cada página declara qué rol requiere.
   ============================================================ */

const LATIR_SESSION = (function () {

  // ── Configuración ──────────────────────────────────────────
  const HARD_TTL        = 2 * 60 * 60 * 1000;  // 2 horas
  const INACTIVITY_TTL  = 30 * 60 * 1000;       // 30 minutos
  const INACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

  let _inactivityTimer  = null;
  let _logoutFn         = null;
  let _warningShown     = false;

  // ── Claves de sesión por rol ───────────────────────────────
  const KEYS = {
    donante:  'latir_donante',
    paciente: 'pacienteSession',
    admin:    'latir_user',
  };

  // ── Resolver clave de almacenamiento desde rol o clave legacy ─
  function _getStorageKey(roleOrKey) {
    if (KEYS[roleOrKey]) {
      return KEYS[roleOrKey];
    }
    return roleOrKey;
  }

  // ── Escribir en almacenamiento dual (sessionStorage + localStorage) ──
  function _setItem(key, payload) {
    const val = JSON.stringify(payload);
    try {
      sessionStorage.setItem(key, val);
    } catch (e) {
      console.warn("sessionStorage write failed:", e);
    }
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }
  }

  // ── Leer desde almacenamiento dual (intenta sessionStorage, cae a localStorage) ──
  function _getItem(key) {
    let raw = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch (e) {
      console.warn("sessionStorage read failed:", e);
    }
    if (!raw) {
      try {
        raw = localStorage.getItem(key);
        // Sincronizar de vuelta a sessionStorage si se encontró en localStorage
        if (raw) {
          try { sessionStorage.setItem(key, raw); } catch {}
        }
      } catch (e) {
        console.warn("localStorage read failed:", e);
      }
    }
    return raw;
  }

  // ── Eliminar de ambos almacenamientos ─────────────────────
  function _removeItem(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  // ── Guardar sesión con timestamps ─────────────────────────
  function guardar(roleOrKey, datos) {
    const key = _getStorageKey(roleOrKey);
    const payload = {
      ...datos,
      __loginAt:    Date.now(),
      __expiresAt:  Date.now() + HARD_TTL,
      __lastActive: Date.now(),
    };
    _setItem(key, payload);
  }

  // ── Leer sesión validando expiración ─────────────────────
  function leer(roleOrKey) {
    const key = _getStorageKey(roleOrKey);
    const raw = _getItem(key);
    if (!raw) return null;

    let datos;
    try { datos = JSON.parse(raw); } catch { return null; }

    const ahora = Date.now();

    // Expiración dura
    if (datos.__expiresAt && ahora > datos.__expiresAt) {
      _removeItem(key);
      return null;
    }

    // Expiración por inactividad
    if (datos.__lastActive && ahora - datos.__lastActive > INACTIVITY_TTL) {
      _removeItem(key);
      return null;
    }

    return datos;
  }

  // ── Actualizar timestamp de actividad ─────────────────────
  function _tocarSesion() {
    _warningShown = false;
    Object.values(KEYS).forEach(key => {
      const raw = _getItem(key);
      if (!raw) return;
      try {
        const datos = JSON.parse(raw);
        if (datos.__lastActive !== undefined) {
          datos.__lastActive = Date.now();
          _setItem(key, datos);
        }
      } catch {}
    });
  }

  // ── Limpiar todas las sesiones ────────────────────────────
  function limpiarTodo() {
    Object.values(KEYS).forEach(k => _removeItem(k));
    _removeItem('pacienteSession'); // legacy cleanup
  }

  // ── Reiniciar timer de inactividad ────────────────────────
  function _resetTimer() {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(() => {
      // Aviso 2 minutos antes de cerrar (opcional, evita sorpresas)
      if (!_warningShown) {
        _warningShown = true;
        _mostrarAviso();
      }
    }, INACTIVITY_TTL - 2 * 60 * 1000); // avisa 2 min antes
  }

  // ── Mostrar aviso de inactividad ──────────────────────────
  function _mostrarAviso() {
    // Crear banner de aviso si no existe
    let banner = document.getElementById('__latir_inactivity_banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__latir_inactivity_banner';
      banner.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:#1e293b; color:#f1f5f9; padding:14px 24px;
        border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.35);
        font-family:'DM Sans',sans-serif; font-size:0.88rem;
        display:flex; align-items:center; gap:14px; z-index:99999;
        border:1px solid rgba(192,82,42,0.4);
        animation: slideUp 0.3s ease;
      `;
      banner.innerHTML = `
        <style>@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>
        <span style="font-size:1.2rem;">⏱️</span>
        <span>Tu sesión expirará en <strong id="__latir_countdown" style="color:#f97316;">2:00</strong> por inactividad.</span>
        <button onclick="LATIR_SESSION.extenderSesion()" style="background:#c0522a;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-family:inherit;font-weight:600;">Seguir activo</button>
      `;
      document.body.appendChild(banner);

      // Countdown de 2 minutos
      let segundos = 120;
      const interval = setInterval(() => {
        segundos--;
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        const el = document.getElementById('__latir_countdown');
        if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (segundos <= 0) {
          clearInterval(interval);
          _cerrarSesionPorInactividad();
        }
      }, 1000);

      banner._interval = interval;
    }
  }

  // ── Extender sesión (botón "Seguir activo") ───────────────
  function extenderSesion() {
    _warningShown = false;
    const banner = document.getElementById('__latir_inactivity_banner');
    if (banner) {
      clearInterval(banner._interval);
      banner.remove();
    }
    _tocarSesion();
    _resetTimer();
  }

  // ── Cerrar sesión por inactividad ─────────────────────────
  function _cerrarSesionPorInactividad() {
    limpiarTodo();
    if (_logoutFn) {
      _logoutFn('inactividad');
    } else {
      window.location.href = 'auth.html?tab=login&motivo=inactividad';
    }
  }

  // ── Iniciar vigilancia de inactividad ─────────────────────
  function iniciarVigilancia(logoutCallback) {
    _logoutFn = logoutCallback || null;
    _resetTimer();
    INACTIVITY_EVENTS.forEach(evt => {
      document.addEventListener(evt, () => {
        _tocarSesion();
        _resetTimer();
      }, { passive: true });
    });
  }

  // ── Proteger página: verifica rol y redirige si no hay sesión ──
  function proteger(rol, redirectUrl) {
    const key = KEYS[rol];
    if (!key) return null;

    const sesion = leer(key);
    if (!sesion) {
      const destino = redirectUrl || `auth.html?tab=login&role=${rol}&motivo=sesion_expirada`;
      window.location.href = destino;
      return null;
    }

    // Iniciar vigilancia automáticamente en páginas protegidas
    iniciarVigilancia(() => {
      window.location.href = `auth.html?tab=login&role=${rol}&motivo=inactividad`;
    });

    return sesion;
  }

  // ── API pública ───────────────────────────────────────────
  return {
    guardar,
    leer,
    limpiarTodo,
    proteger,
    iniciarVigilancia,
    extenderSesion,
    KEYS,
  };

})();
