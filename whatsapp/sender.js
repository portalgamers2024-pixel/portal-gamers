'use strict';

const fetch = require('node-fetch');

const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const TOKEN    = process.env.WHATSAPP_TOKEN;

// TIENDA: recibe pedidos y solicitudes de asesor
// DUENO:  recibe solo el resumen diario
const TIENDA = process.env.WHATSAPP_TIENDA || '573223427456';
const DUENO  = process.env.WHATSAPP_DUENO  || '573016008994';

// ─── Estadísticas diarias en memoria ────────────────────────────────────────
const _stats = { pedidos: 0, totalUSD: 0, asesores: 0, date: '' };

function _resetIfNewDay() {
  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  if (_stats.date !== today) {
    _stats.pedidos  = 0;
    _stats.totalUSD = 0;
    _stats.asesores = 0;
    _stats.date     = today;
  }
}

function trackStat(type, amount = 0) {
  _resetIfNewDay();
  if (type === 'pedido') { _stats.pedidos++; _stats.totalUSD += Number(amount) || 0; }
  if (type === 'asesor') _stats.asesores++;
}

function getDailyStats() {
  _resetIfNewDay();
  return { ..._stats };
}

// ─── Envío de mensajes ───────────────────────────────────────────────────────

async function sendMessage(to, message) {
  if (!PHONE_ID || !TOKEN) {
    console.log(`[WA→${to}] ${message.slice(0, 100).replace(/\n/g, ' ')}...`);
    return;
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:   String(to).replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await r.json();
    if (!r.ok) console.error('[WA] Error al enviar:', JSON.stringify(data));
  } catch (err) {
    console.error('[WA] Fetch error:', err.message);
  }
}

// ─── Notificaciones operacionales ───────────────────────────────────────────

async function sendOrderNotification(orderData, type) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  if (type === 'PEDIDO') {
    // Notificar SOLO a la TIENDA (empleado)
    const msg =
`🔔 *NUEVO PEDIDO - Portal Gamers LATAM*

👤 *Cliente:* ${orderData.nombre || 'No indicado'}
🎯 *Usuario juego:* ${orderData.usuarioJuego}
🌍 *País:* ${orderData.pais}
📱 *WhatsApp cliente:* +${orderData.phone}

🎮 *Juego:* ${orderData.juego}
🌐 *Servidor:* ${orderData.servidor}
💰 *Cantidad:* ${orderData.cantidad}M ${orderData.moneda || 'Kamas'}

💵 *Total USD:* $${orderData.precioUSD}
💴 *Total local:* ${orderData.precioLocal}
💳 *Método de pago:* ${orderData.metodoPago}

⏰ ${ts}
✅ *Cliente confirmó pago — VERIFICAR Y ENTREGAR*`;

    await sendMessage(TIENDA, msg);
    trackStat('pedido', orderData.precioUSD);

  } else if (type === 'ASESOR') {
    // Notificar SOLO a la TIENDA (empleado)
    const msg =
`🎧 *SOLICITUD DE ASESOR — ATENCIÓN REQUERIDA*
━━━━━━━━━━━━━━━━━━━━
📱 *Cliente:* +${orderData.phone}
👤 *Nombre:* ${orderData.nombre || 'No indicado'}
💬 *Consulta:* ${orderData.mensajeAsesor}

⏰ ${ts}
━━━━━━━━━━━━━━━━━━━━
⚠️ Bot PAUSADO para este cliente
Contáctalo directamente para atenderlo.`;

    await sendMessage(TIENDA, msg);
    trackStat('asesor');
  }
}

// ─── Resumen diario (SOLO al dueño) ─────────────────────────────────────────

async function sendDailySummary() {
  const stats = getDailyStats();
  const msg =
`📊 *Resumen diario — Portal Gamers LATAM*
━━━━━━━━━━━━━━━━━━━━
📅 ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}

🛒 Pedidos recibidos: ${stats.pedidos}
💵 Total vendido: $${stats.totalUSD.toFixed(2)} USD
🎧 Solicitudes asesor: ${stats.asesores}
━━━━━━━━━━━━━━━━━━━━`;

  // SOLO al dueño, nunca a la tienda ni a clientes
  await sendMessage(DUENO, msg);
}

module.exports = { sendMessage, sendOrderNotification, sendDailySummary, trackStat, getDailyStats };
