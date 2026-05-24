const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

// Pestaña "💰 Precios": datos desde fila 6
// Col A=Juego, B=Servidor, C=Venta USD, D=Venta MXN, E=Venta CLP
//     F=Compra USD, I=Venta COP, O=Venta BS/VES
const TAB_PRECIOS  = '💰 Precios';
const TAB_VENTAS   = '📝 Ventas';
const TAB_WOW_GOLD = 'WOW_GOLD';

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
  if (_auth) return _auth;
  // En Railway: credenciales como JSON en variable de entorno
  // En local:   leer sheets-key.json como fallback
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    _auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  } else {
    _auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'sheets-key.json'),
      scopes: SCOPES,
    });
  }
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
    range: `${TAB_PRECIOS}!A6:O100`,
  });

  const result = {};
  let currentGameId = null;

  for (const row of res.data.values || []) {
    // C(2)=Venta USD, D(3)=Venta MXN, E(4)=Venta CLP
    // F(5)=Compra USD, I(8)=Venta COP, O(14)=Venta BS/VES
    const gameRaw  = row[0];
    const server   = row[1];
    const ventaRaw = row[2];
    const mxnRaw   = row[3];
    const clpRaw   = row[4];
    const compraRaw = row[5];
    const copRaw   = row[8];
    const vesRaw   = row[14];

    if (gameRaw && gameRaw.trim()) {
      const mapped = GAME_NAME_MAP[gameRaw.trim().toUpperCase()] || null;
      if (mapped) {
        currentGameId = mapped;
      } else {
        const key = Object.keys(GAME_NAME_MAP).find(k => gameRaw.toUpperCase().includes(k));
        currentGameId = key ? GAME_NAME_MAP[key] : null;
      }
    }

    if (!currentGameId || !server || !server.trim()) continue;
    if (server.trim().startsWith('📈') || server.trim().startsWith('MARGEN')) continue;

    const venta  = parseNum(ventaRaw);
    const compra = parseNum(compraRaw);
    const mxn    = parseNum(mxnRaw);
    const clp    = parseNum(clpRaw);
    const cop    = parseNum(copRaw);
    const ves    = parseNum(vesRaw);
    if (!venta) continue;

    if (!result[currentGameId]) result[currentGameId] = {};
    result[currentGameId][server.trim()] = {
      venta,
      compra,
      ...(mxn  && { mxn }),
      ...(clp  && { clp }),
      ...(cop  && { cop }),
      ...(ves  && { ves }),
    };
  }

  // Leer precios de WoW Gold desde pestaña WOW_GOLD
  try {
    const wowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_WOW_GOLD}!A2:L10`,
    });
    const wowRows = wowRes.data.values || [];
    if (wowRows.length) {
      result['wow-retail'] = {};
      for (const row of wowRows) {
        const serverName = row[0]?.trim();
        const activo     = row[11]?.trim()?.toUpperCase();
        if (!serverName || activo === 'NO') continue;
        const venta  = parseNum(row[4]);
        const compra = parseNum(row[1]);
        const cop    = parseNum(row[5]);
        const ves    = parseNum(row[6]);
        const clp    = parseNum(row[7]);
        const mxn    = parseNum(row[8]);
        if (!venta) continue;
        result['wow-retail'][serverName] = { venta, compra, cop, ves, clp, mxn };
      }
    }
  } catch (e) {
    console.warn('[Sheets] Error leyendo WOW_GOLD:', e.message);
  }

  // Calcular meta por juego (precio mínimo de venta entre todos los servidores)
  for (const [gameId, servers] of Object.entries(result)) {
    const ventas = Object.values(servers).filter(s => typeof s === 'object' && s.venta).map(s => s.venta);
    if (!ventas.length) continue;
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

async function logOrder({ nombre, usuario_juego, pais, email, juego, servidor, cantidad, total_usd, total_local, metodo_pago }) {
  if (!SHEET_ID) return;
  const sheets = await api();
  const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB_VENTAS}!A:L`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        fecha,
        nombre        || '',
        usuario_juego || '',
        pais          || '',
        email         || '',
        juego         || '',
        servidor      || '',
        cantidad      || '',
        total_usd     ? `$${Number(total_usd).toFixed(2)}` : '',
        total_local   || '',
        metodo_pago   || '',
        'PENDIENTE VERIFICACION',
      ]],
    },
  });
  invalidateCache();
}

let resenasCache = { data: null, ts: 0 };

async function getResenas() {
  if (!SHEET_ID) return [];
  const now = Date.now();
  if (resenasCache.data && now - resenasCache.ts < TTL) return resenasCache.data;

  const sheetsApi = await api();
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'RESEÑAS!A2:E100',
  });

  const rows = res.data.values || [];
  const data = rows
    .filter(row => row[0] && row[1])
    .map(row => ({
      nombre:   row[0] || '',
      resena:   row[1] || '',
      juego:    row[2] || 'Portal Gamers',
      fecha:    row[3] || '',
      estrellas: parseInt(row[4]) || 5,
      inicial:  (row[0] || 'U')[0].toUpperCase(),
    }));

  resenasCache = { data, ts: now };
  return data;
}

module.exports = { getPricesFromSheet, getResenas, logSale, logOrder, invalidateCache };
