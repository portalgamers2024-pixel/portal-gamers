'use strict';

const { getSession, updateSession, clearSession } = require('./sessions');
const { getProducts, generateCatalog, getGameMenu, getServerMenu, calculatePrice } = require('./catalog');
const { sendMessage, sendOrderNotification } = require('./sender');
const sheets = require('../sheets');

// ─── Datos de pago por país ──────────────────────────────────────────────────

const PAYMENT_INFO = {
  Colombia:
`💳 *Métodos de pago Colombia:*

📱 *Nequi / Daviplata*
Número: 3016008994

🔑 *Llave Colombia*
Número: 3016008994

🏦 *Banco Unión Colombia*
Cuenta Ahorros: 01735600000529916
A nombre de: Leandro Jose Acosta Garcia
Cédula: 1082985969

💸 *Remitly*
Cuenta Bancolombia: 77903852944
Cel: 3016008994`,

  Venezuela:
`💳 *Métodos de pago Venezuela:*

📱 *Pago Móvil*
Número: 04126275407
Cédula: 23642839

🔑 *Llave Colombia*
Número: 3016008994

₿ *Binance*
andressuperlano@gmail.com`,

  Chile:
`💳 *Método de pago Chile:*

🏦 *Cuenta RUT Banco Estado*
Titular: Felipe Ignacio Muñoz Pontigo
RUT: 17342378-0`,

  Mexico:
`💳 *Método de pago México:*

🏦 *Transferencia Santander*
Número: 5579 0900 4324 8252
Titular: Carlos Heredia`,

  Otro:
`💳 *Métodos de pago internacionales:*

₿ *Binance*
andressuperlano@gmail.com
leandro.acosta940614@outlook.com

💳 *Skrill*
leandro.acosta940614@outlook.com

💸 *Remitly*
leandro.acosta940614@gmail.com`,
};

const PAYMENT_LABEL = {
  Colombia:  'Nequi / Llave / Banco Unión / Remitly',
  Venezuela: 'Pago Móvil / Llave / Binance',
  Chile:     'Cuenta RUT Banco Estado',
  Mexico:    'Santander',
  Otro:      'Binance / Skrill / Remitly',
};

const PAISES = ['Colombia', 'Venezuela', 'Chile', 'Mexico', 'Otro'];

// ─── Palabras clave ──────────────────────────────────────────────────────────

const CONFIRM_KEYWORDS = ['pague', 'ya pague', 'listo', 'paid', 'hecho', 'realice el pago', 'pago hecho', 'ya realize', 'realice'];
const MENU_KEYWORDS    = ['menu', 'inicio', 'start', 'hola', 'hi', 'hello', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches'];
const CANCEL_KEYWORDS  = ['cancelar', 'cancel', 'salir', 'exit'];
const ASESOR_KEYWORDS  = ['asesor', 'humano', 'persona', 'hablar con', 'quiero hablar', 'necesito ayuda'];

function normalize(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ─── Menú principal ──────────────────────────────────────────────────────────

async function sendMenu(phone, name) {
  updateSession(phone, { estado: 'MENU' });
  const greeting = name ? `👋 ¡Hola ${name}! ` : '👋 ¡Hola! ';
  await sendMessage(phone,
    `${greeting}Bienvenido a *Portal Gamers LATAM* 🎮\n\n` +
    `¿Qué deseas hacer?\n\n` +
    `1️⃣ Ver catálogo de precios\n` +
    `2️⃣ Hacer un pedido\n` +
    `3️⃣ Estado de mi pedido\n` +
    `4️⃣ Hablar con un asesor\n\n` +
    `_Responde con el número de tu opción_`
  );
}

// ─── Handler principal ───────────────────────────────────────────────────────

async function handleMessage(phone, messageBody, name) {
  const session = getSession(phone);
  const msg     = normalize(messageBody);
  const raw     = messageBody.trim();

  // Si bot pausado (empleado atiende manualmente), no intervenir
  if (session.conAsesor) {
    console.log(`[bot] ${phone} está con asesor — ignorando mensaje`);
    return;
  }

  // Comandos globales (cancelar, menú)
  if (CANCEL_KEYWORDS.some(k => msg === k)) {
    clearSession(phone);
    return sendMenu(phone, name);
  }
  if (MENU_KEYWORDS.some(k => msg === k)) {
    return sendMenu(phone, name);
  }

  // "asesor" como comando rápido (fuera del flujo de selección de asesor)
  if (
    ASESOR_KEYWORDS.some(k => msg === k || msg.includes(k)) &&
    session.estado !== 'ESPERANDO_ASESOR'
  ) {
    updateSession(phone, { estado: 'ESPERANDO_ASESOR' });
    return sendMessage(phone,
      `🎧 Un asesor te atenderá pronto.\n\nDescribe brevemente tu consulta:`
    );
  }

  // Máquina de estados
  switch (session.estado) {
    case 'INICIO':
    case 'MENU':
      return handleMenuOption(phone, msg, name);

    case 'SELECCION_JUEGO':
      return handleGameSelection(phone, msg);

    case 'SELECCION_SERVIDOR':
      return handleServerSelection(phone, msg, session);

    case 'SELECCION_CANTIDAD':
      return handleQuantitySelection(phone, msg, session);

    case 'SELECCION_PAIS':
      return handleCountrySelection(phone, msg, session);

    case 'ESPERANDO_USUARIO_JUEGO':
      return handleUsernameInput(phone, raw, session);

    case 'ESPERANDO_CONFIRMACION':
      return handleConfirmation(phone, msg, session);

    case 'PEDIDO_COMPLETADO':
      return sendMenu(phone, name);

    case 'ESPERANDO_ASESOR':
      return handleAsesorRequest(phone, raw, name, session);

    default:
      return sendMenu(phone, name);
  }
}

// ─── Handlers por estado ─────────────────────────────────────────────────────

async function handleMenuOption(phone, msg, name) {
  switch (msg) {
    case '1': {
      updateSession(phone, { estado: 'MENU' });
      const catalog = await generateCatalog();
      await sendMessage(phone, catalog);
      await sendMessage(phone, '¿Deseas hacer un pedido? Escribe *2* 🛒');
      break;
    }
    case '2': {
      updateSession(phone, { estado: 'SELECCION_JUEGO' });
      const { text } = getGameMenu();
      await sendMessage(phone, text);
      break;
    }
    case '3': {
      await sendMessage(phone,
        `📦 *Consulta de pedido*\n\nIndícanos:\n` +
        `• Tu usuario/nick en el juego\n` +
        `• El juego que compraste\n\n` +
        `Te respondemos en minutos ✅`
      );
      break;
    }
    case '4': {
      updateSession(phone, { estado: 'ESPERANDO_ASESOR' });
      await sendMessage(phone,
        `🎧 Un asesor te atenderá pronto.\n\nDescribe brevemente tu consulta:`
      );
      break;
    }
    default: {
      await sendMessage(phone,
        `No entendí esa opción 😅\n\nResponde con un número del 1 al 4.\n\n` +
        `1️⃣ Ver catálogo\n2️⃣ Hacer pedido\n3️⃣ Estado pedido\n4️⃣ Hablar con asesor`
      );
    }
  }
}

async function handleGameSelection(phone, msg) {
  const games = getProducts();
  const idx   = parseInt(msg) - 1;

  if (isNaN(idx) || idx < 0 || idx >= games.length) {
    return sendMessage(phone,
      `Por favor responde con un número del 1 al ${games.length}.\n\n` +
      getGameMenu().text
    );
  }

  const game = games[idx];
  updateSession(phone, {
    estado:  'SELECCION_SERVIDOR',
    juegoId: game.id,
    juego:   game.name,
    moneda:  game.currency_name,
  });

  const { text } = await getServerMenu(game);
  await sendMessage(phone, text);
}

async function handleServerSelection(phone, msg, session) {
  const game = getProducts().find(g => g.id === session.juegoId);
  if (!game) return sendMenu(phone, null);

  const idx = parseInt(msg) - 1;
  if (isNaN(idx) || idx < 0 || idx >= game.servers.length) {
    const { text } = await getServerMenu(game);
    return sendMessage(phone,
      `Por favor responde con un número del 1 al ${game.servers.length}.\n\n${text}`
    );
  }

  const server = game.servers[idx];
  updateSession(phone, { servidor: server, estado: 'SELECCION_CANTIDAD' });

  await sendMessage(phone,
    `💰 *¿Cuántos millones de ${session.moneda || 'Kamas'}?*\n\n` +
    `Mínimo: ${game.min_millions}M | Máximo: ${game.max_millions}M\n` +
    `Ejemplos: 1, 5, 10, 25, 50, 100\n\n` +
    `_Escribe solo el número_`
  );
}

async function handleQuantitySelection(phone, msg, session) {
  const game = getProducts().find(g => g.id === session.juegoId);
  if (!game) return sendMenu(phone, null);

  const qty = parseInt(msg);
  if (isNaN(qty) || qty < game.min_millions || qty > game.max_millions) {
    return sendMessage(phone,
      `Por favor escribe un número entre ${game.min_millions} y ${game.max_millions}.\n_Ej: 10_`
    );
  }

  updateSession(phone, { cantidad: qty, estado: 'SELECCION_PAIS' });

  await sendMessage(phone,
    `🌍 *¿De qué país eres?*\n\n` +
    `1️⃣ 🇨🇴 Colombia\n` +
    `2️⃣ 🇻🇪 Venezuela\n` +
    `3️⃣ 🇨🇱 Chile\n` +
    `4️⃣ 🇲🇽 México\n` +
    `5️⃣ 🌍 Otro país\n\n` +
    `_Responde con el número_`
  );
}

async function handleCountrySelection(phone, msg, session) {
  const idx = parseInt(msg) - 1;
  if (isNaN(idx) || idx < 0 || idx >= PAISES.length) {
    return sendMessage(phone, `Por favor responde con un número del 1 al ${PAISES.length}.`);
  }

  const country = PAISES[idx];
  const game    = getProducts().find(g => g.id === session.juegoId);
  if (!game) return sendMenu(phone, null);

  const { totalUSD, localStr } = await calculatePrice(game, session.servidor, session.cantidad, country);

  updateSession(phone, {
    pais:       country,
    precioUSD:  totalUSD.toFixed(2),
    precioLocal: localStr,
    estado:     'ESPERANDO_USUARIO_JUEGO',
  });

  // Mostrar métodos de pago
  const paymentMsg = PAYMENT_INFO[country] || PAYMENT_INFO.Otro;
  await sendMessage(phone, paymentMsg);

  // Resumen + solicitar usuario en el juego
  await sendMessage(phone,
    `📋 *Resumen de tu pedido:*\n━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 ${session.juego} — ${session.servidor}\n` +
    `💰 ${session.cantidad}M ${session.moneda || 'Kamas'}\n` +
    `💵 $${totalUSD.toFixed(2)} USD\n` +
    `💴 ${localStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Antes de pagar dinos:\n` +
    `*¿Cuál es tu nick/usuario en el juego?*`
  );
}

async function handleUsernameInput(phone, raw, session) {
  if (!raw || raw.length < 1) {
    return sendMessage(phone, `Por favor escribe tu nick/usuario en el juego.`);
  }

  updateSession(phone, { usuarioJuego: raw, estado: 'ESPERANDO_CONFIRMACION' });

  await sendMessage(phone,
    `✅ ¡Perfecto! Realiza el pago y cuando lo hayas completado escribe: *PAGUÉ*\n\n` +
    `⏳ Entregaremos en máx. 5 minutos después de verificar. 🚀`
  );
}

async function handleConfirmation(phone, msg, session) {
  const confirmed = CONFIRM_KEYWORDS.some(k => msg.includes(normalize(k)));

  if (!confirmed) {
    return sendMessage(phone,
      `Cuando realices el pago escribe *PAGUÉ* para confirmar.\n\n` +
      `¿Necesitas ayuda? Escribe *asesor*`
    );
  }

  // Registrar en Google Sheets
  try {
    await sheets.logOrder({
      nombre:        session.nombre  || '',
      usuario_juego: session.usuarioJuego,
      pais:          session.pais,
      email:         '',
      juego:         session.juego,
      servidor:      session.servidor,
      cantidad:      session.cantidad,
      total_usd:     session.precioUSD,
      total_local:   session.precioLocal,
      metodo_pago:   (PAYMENT_LABEL[session.pais] || 'Internacional') + ' (Bot)',
    });
  } catch (err) {
    console.error('[bot] Error registrando en Sheets:', err.message);
  }

  // Notificar SOLO a la tienda (empleado)
  await sendOrderNotification({
    phone,
    nombre:       session.nombre || 'No indicado',
    usuarioJuego: session.usuarioJuego,
    pais:         session.pais,
    juego:        session.juego,
    servidor:     session.servidor,
    cantidad:     session.cantidad,
    moneda:       session.moneda || 'Kamas',
    precioUSD:    session.precioUSD,
    precioLocal:  session.precioLocal,
    metodoPago:   PAYMENT_LABEL[session.pais] || 'Internacional',
  }, 'PEDIDO');

  updateSession(phone, { estado: 'PEDIDO_COMPLETADO' });

  await sendMessage(phone,
    `🎉 *¡Pedido registrado!*\n\n` +
    `Estamos verificando tu pago.\n` +
    `En breve recibirás tus ${session.moneda || 'Kamas'}. ⚡\n\n` +
    `⏱️ Tiempo: *5 minutos*\n` +
    `🎮 Usuario: ${session.usuarioJuego}\n\n` +
    `¿Dudas? Escribe *asesor*\n` +
    `¡Gracias por Portal Gamers LATAM! 🙏`
  );
}

async function handleAsesorRequest(phone, raw, name, session) {
  if (!raw || raw.length < 2) {
    return sendMessage(phone, `Por favor describe tu consulta y un asesor te atenderá.`);
  }

  updateSession(phone, {
    estado:        'CON_ASESOR',
    conAsesor:     true,
    mensajeAsesor: raw,
  });

  // Notificar SOLO a la tienda (empleado)
  await sendOrderNotification({
    phone,
    nombre:        session.nombre || name || 'No indicado',
    mensajeAsesor: raw,
  }, 'ASESOR');

  await sendMessage(phone,
    `✅ Consulta enviada a nuestro equipo.\n\n` +
    `Un asesor te contactará en minutos.\n` +
    `Horario: Lun-Dom 10AM — 10PM 🕙\n\n` +
    `_Portal Gamers LATAM_ 🎮`
  );
}

module.exports = { handleMessage };
