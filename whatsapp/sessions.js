'use strict';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

const sessions = new Map();

function createSession() {
  return {
    estado:        'INICIO',
    juegoId:       null,
    juego:         null,
    moneda:        null,
    servidor:      null,
    cantidad:      null,
    precioUSD:     null,
    precioLocal:   null,
    pais:          null,
    metodoPago:    null,
    nombre:        null,
    usuarioJuego:  null,
    mensajeAsesor: null,
    timestamp:     Date.now(),
    conAsesor:     false,
  };
}

function getSession(phone) {
  const s = sessions.get(phone);
  if (!s) {
    const ns = createSession();
    sessions.set(phone, ns);
    return ns;
  }
  // Expirar sesión inactiva (no si está con asesor)
  if (!s.conAsesor && Date.now() - s.timestamp > TIMEOUT_MS) {
    const ns = createSession();
    sessions.set(phone, ns);
    return ns;
  }
  s.timestamp = Date.now();
  return s;
}

function updateSession(phone, data) {
  const s = getSession(phone);
  Object.assign(s, data, { timestamp: Date.now() });
  sessions.set(phone, s);
}

function clearSession(phone) {
  sessions.delete(phone);
}

// Limpiar sesiones expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [phone, session] of sessions.entries()) {
    if (!session.conAsesor && now - session.timestamp > TIMEOUT_MS) {
      sessions.delete(phone);
    }
  }
}, 5 * 60 * 1000);

module.exports = { getSession, updateSession, clearSession };
