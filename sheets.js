const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const KEY_FILE = path.join(__dirname, 'sheets-key.json');
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

// Pestaña "💰 Precios": datos desde fila 6
// Col A=Juego, B=Servidor, C=Venta USD/M, F=Compra USD/M
const TAB_PRECIOS = '💰 Precios';
const TAB_VENTAS  = '📝 Ventas';

// Mapa de nombres en el Sheet → IDs en products.json
const GAME_NAME_MAP = {
  'DOFUS TOUCH': 'dofus-touch',
  'DOFUS 3.0':   'dofus-3',
  'DOFUS RETRO': 'dofus-retro',
  'WAKFU':       'wakfu',
  'ALBION':      'albion',
  'WOW RETAIL':  'wow-retail',
};

// Números en formato europeo: "1.881,60" → 1881.60 | "1,96" → 1.96
function parseNum(str) {
  if (!str || typeof str !== 'string') return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

let _auth;
function getAuth() {
  if (!_auth) _auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  return _auth;
}
async function api() {
  const client = await getAuth().getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// ─── Cache 60 s ────────────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const TTL = 60_000;

/**
 * Retorna: { [game_id]: { [serverName]: { venta, compra } } }
 * También incluye metadata por juego: { [game_id]._meta: { min_venta, max_venta } }
 */
async function getPricesFromSheet() {
  if (!SHEET_ID) return null;
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) return cache.data;

  const sheets = await api();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_PRECIOS}!A6:J100`,
  });

  const result = {};
  let currentGameId = null;

  for (const row of res.data.values || []) {
    const [gameRaw, server, ventaRaw, , , compraRaw] = row;

    // Si col A tiene valor, es un juego nuevo
    if (gameRaw && gameRaw.trim()) {
      const mapped = GAME_NAME_MAP[gameRaw.trim().toUpperCase()] || null;
      // Intento flexible si no hay match exacto
      if (mapped) {
        currentGameId = mapped;
      } else {
        const key = Object.keys(GAME_NAME_MAP).find(k => gameRaw.toUpperCase().includes(k));
        currentGameId = key ? GAME_NAME_MAP[key] : null;
      }
    }

    if (!currentGameId || !server || !server.trim()) continue;
    // Ignorar filas de totales/márgenes
    if (server.trim().startsWith('📈') || server.trim().startsWith('MARGEN')) continue;

    const venta  = parseNum(ventaRaw);
    const compra = parseNum(compraRaw);
    if (!venta) continue;

    if (!result[currentGameId]) result[currentGameId] = {};
    result[currentGameId][server.trim()] = { venta, compra };
  }

  // Calcular meta por juego (precio mínimo de venta entre todos los servidores)
  for (const [gameId, servers] of Object.entries(result)) {
    const ventas = Object.values(servers).map(s => s.venta);
    result[gameId]._meta = {
      min_venta: Math.min(...ventas),
      max_venta: Math.max(...ventas),
    };
  }

  cache = { data: result, ts: now };
  return result;
}

function invalidateCache() { cache.ts = 0; }

/**
 * Registra una venta en la pestaña "📝 Ventas".
 * Columnas existentes: FECHA | ASESOR | CANAL | JUEGO | SERVIDOR | CANTIDAD (M) | MONEDA | PRECIO/M | TOTAL VENTA | TOTAL USD
 */
async function logSale({ juego, servidor, cantidad, precio_m, total_usd, moneda, canal, asesor, pago_id }) {
  if (!SHEET_ID) return;
  const sheets = await api();
  const fecha  = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const totalVenta = total_usd ? `$${Number(total_usd).toFixed(2)}` : '';

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_VENTAS}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        fecha,
        asesor  || 'Sistema',
        canal   || 'Web',
        juego   || '',
        servidor || '',
        cantidad || '',
        moneda  || '',
        precio_m ? `$${Number(precio_m).toFixed(2)}` : '',
        totalVenta,
        totalVenta,
      ]],
    },
  });
  invalidateCache();
}

module.exports = { getPricesFromSheet, logSale, invalidateCache };
