'use strict';

const fetch  = require('node-fetch');
const sheets = require('../sheets');

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

// compras del día en USD — actualizable vía trackCompra()
const _comprasHoy = { totalUSD: 0, count: 0, date: '' };

function trackCompra(amountUSD = 0) {
  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  if (_comprasHoy.date !== today) { _comprasHoy.totalUSD = 0; _comprasHoy.count = 0; _comprasHoy.date = today; }
  _comprasHoy.totalUSD += Number(amountUSD) || 0;
  _comprasHoy.count++;
}

async function sendDailySummary() {
  const stats  = getDailyStats();
  const fecha  = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });

  // Leer ventas reales del día desde Google Sheets (fuente de verdad)
  let sheetVentas = { totalUSD: 0, count: 0 };
  try { sheetVentas = await sheets.getDailySalesStats(); } catch (_) {}

  // Combinar pedidos web (bot) + registros manuales del sheet
  const totalVentaUSD = Math.max(stats.totalUSD, sheetVentas.totalUSD);
  const totalPedidos  = Math.max(stats.pedidos,   sheetVentas.count);

  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  if (_comprasHoy.date !== today) { _comprasHoy.totalUSD = 0; _comprasHoy.count = 0; }
  const compraUSD   = _comprasHoy.totalUSD;
  const gananciaNeta = totalVentaUSD - compraUSD;
  const margenPct    = totalVentaUSD > 0 ? (gananciaNeta / totalVentaUSD * 100).toFixed(1) : '0.0';

  const msg =
`📊 *Resumen diario — Portal Gamers LATAM*
━━━━━━━━━━━━━━━━━━━━
📅 ${fecha}

💚 *VENTAS*
  🛒 Transacciones: ${totalPedidos}
  💵 Total vendido: $${totalVentaUSD.toFixed(2)} USD

🔴 *COMPRAS*
  🧾 Transacciones: ${_comprasHoy.count}
  💰 Total comprado: $${compraUSD.toFixed(2)} USD

📈 *RESULTADO*
  💹 Ganancia neta: $${gananciaNeta.toFixed(2)} USD
  📊 Margen: ${margenPct}%
  🎧 Solicitudes asesor: ${stats.asesores}
━━━━━━━━━━━━━━━━━━━━
Ver detalle: Registro Rápido → TOTALES DEL DÍA`;

  // SOLO al dueño, nunca a la tienda ni a clientes
  await sendMessage(DUENO, msg);
}

module.exports = { sendMessage, sendOrderNotification, sendDailySummary, trackStat, getDailyStats, trackCompra };
