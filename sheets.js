const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

// Pestaña "💰 Precios": datos desde fila 6 (después de headers)
// Tasas desde fila 2:
//   COMPRA: P2=MEX, Q2=CLP, R2=COP, S2=BS
//   VENTA:  T2=MEX, U2=CLP, V2=COP, W2=BS
// Precios desde fila 6:
//   A=Juego, B=Servidor
//   C=Venta USD (base), D=Venta MEX, E=Venta CLP, F=Venta BS, G=Venta COP
//   H=Compra USD (base), I=Compra MEX, J=Compra CLP, K=Compra BS, L=Compra COP

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
 * NUEVA FUNCIÓN: getExchangeRates()
 *
 * Retorna las tasas de cambio desde fila 5 del Sheet:
 * {
 *   compra: { mex: number, clp: number, cop: number, bs: number },
 *   venta:  { mex: number, clp: number, cop: number, bs: number },
 *   raw: {                                          // datos crudos del Sheet
 *     compra: [mex_str, clp_str, cop_str, bs_str],
 *     venta:  [mex_str, clp_str, cop_str, bs_str]
 *   }
 * }
 */
async function getExchangeRates() {
  if (!SHEET_ID) return {
    compra: { mex: 17.0, clp: 800, cop: 3800, bs: 25.0 },
    venta:  { mex: 18.5, clp: 850, cop: 4000, bs: 28.0 }
  };

  try {
    const sheets = await api();

    // Lee fila 2 completa: P2:W2
    // P2=Compra MEX, Q2=Compra CLP, R2=Compra COP, S2=Compra Bs
    // T2=Venta MEX,  U2=Venta CLP,  V2=Venta COP,  W2=Venta Bs
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_PRECIOS}!P2:W2`,
    });

    const row = (res.data.values && res.data.values[0]) || [];

    // Parsea valores
    const compra_mex = parseNum(row[0]); // P2
    const compra_clp = parseNum(row[1]); // Q2
    const compra_cop = parseNum(row[2]); // R2
    const compra_bs  = parseNum(row[3]); // S2

    const venta_mex = parseNum(row[4]); // T2
    const venta_clp = parseNum(row[5]); // U2
    const venta_cop = parseNum(row[6]); // V2
    const venta_bs  = parseNum(row[7]); // W2

    // Validación: si alguna tasa es 0, usa defaults
    const rates = {
      compra: {
        mex: compra_mex || 17.0,
        clp: compra_clp || 800,
        cop: compra_cop || 3800,
        bs:  compra_bs  || 25.0
      },
      venta: {
        mex: venta_mex || 18.5,
        clp: venta_clp || 850,
        cop: venta_cop || 4000,
        bs:  venta_bs  || 28.0
      },
      raw: {
        compra: [row[0], row[1], row[2], row[3]],
        venta:  [row[4], row[5], row[6], row[7]]
      }
    };

    return rates;
  } catch (e) {
    console.warn('[Sheets] Error leyendo tasas:', e.message);
    // Retorna tasas por defecto si falla
    return {
      compra: { mex: 17.0, clp: 800, cop: 3800, bs: 25.0 },
      venta:  { mex: 18.5, clp: 850, cop: 4000, bs: 28.0 }
    };
  }
}

/**
 * FUNCIÓN ACTUALIZADA: getPricesFromSheet()
 *
 * Retorna: {
 *   [game_id]: {
 *     [serverName]: {
 *       venta: USD,
 *       compra: USD,
 *       venta_cop: COP,
 *       compra_cop: COP,
 *       venta_mxn: MXN,
 *       venta_clp: CLP,
 *       venta_bs: Bs,
 *       compra_mxn: MXN,
 *       compra_clp: CLP,
 *       compra_bs: Bs
 *     }
 *   },
 *   [game_id]._meta: { min_venta, max_venta },
 *   _rates: { compra: {...}, venta: {...} }
 * }
 */
async function getPricesFromSheet() {
  if (!SHEET_ID) return null;
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) return cache.data;

  const sheets = await api();

  // Obtiene tasas de cambio
  const rates = await getExchangeRates();

  // Lee precios desde fila 6 (después de headers)
  // Rango: A6:L100
  // A=Juego, B=Servidor, C=Venta USD, D=Venta MEX, E=Venta CLP, F=Venta BS, G=Venta COP
  // H=Compra USD, I=Compra MEX, J=Compra CLP, K=Compra BS, L=Compra COP
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_PRECIOS}!A6:L100`,
  });

  const result = {};
  let currentGameId = null;

  for (const row of res.data.values || []) {
    const gameRaw    = row[0];                // A: Juego
    const server     = row[1];                // B: Servidor
    const ventaUSD   = parseNum(row[2]);      // C: Venta USD (base)
    const ventaMEX   = parseNum(row[3]);      // D: Venta MEX (se recalcula)
    const ventaCLP   = parseNum(row[4]);      // E: Venta CLP (se recalcula)
    const ventaBS    = parseNum(row[5]);      // F: Venta BS (se recalcula)
    const ventaCOP   = parseNum(row[6]);      // G: Venta COP (se recalcula)
    const compraUSD  = parseNum(row[7]);      // H: Compra USD (base)
    const compraMEX  = parseNum(row[8]);      // I: Compra MEX (se recalcula)
    const compraCLP  = parseNum(row[9]);      // J: Compra CLP (se recalcula)
    const compraBS   = parseNum(row[10]);     // K: Compra BS (se recalcula)
    const compraCOP  = parseNum(row[11]);     // L: Compra COP (se recalcula)

    // Identifica juego actual
    if (gameRaw && gameRaw.trim()) {
      const mapped = GAME_NAME_MAP[gameRaw.trim().toUpperCase()] || null;
      if (mapped) {
        currentGameId = mapped;
      } else {
        const key = Object.keys(GAME_NAME_MAP).find(k => gameRaw.toUpperCase().includes(k));
        currentGameId = key ? GAME_NAME_MAP[key] : null;
      }
    }

    // Validación
    if (!currentGameId || !server || !server.trim()) continue;
    if (server.trim().startsWith('📈') || server.trim().startsWith('MARGEN')) continue;
    if (!ventaUSD && !compraUSD) continue; // Si ambos son 0, ignora

    // Mantiene valores del sheet si están presentes, sino recalcula desde USD * tasa
    const finalVentaMEX  = ventaMEX  || ventaUSD * rates.venta.mex;
    const finalVentaCLP  = ventaCLP  || ventaUSD * rates.venta.clp;
    const finalVentaBS   = ventaBS   || ventaUSD * rates.venta.bs;
    const finalVentaCOP  = ventaCOP  || ventaUSD * rates.venta.cop;

    const finalCompraMEX = compraMEX || compraUSD * rates.compra.mex;
    const finalCompraCLP = compraCLP || compraUSD * rates.compra.clp;
    const finalCompraBS  = compraBS  || compraUSD * rates.compra.bs;
    const finalCompraCOP = compraCOP || compraUSD * rates.compra.cop;

    if (!result[currentGameId]) result[currentGameId] = {};
    result[currentGameId][server.trim()] = {
      // Base (USD)
      venta: ventaUSD,
      compra: compraUSD,

      // Derivados (se calculan automáticamente)
      venta_cop: finalVentaCOP,
      compra_cop: finalCompraCOP,
      venta_mxn: finalVentaMEX,
      compra_mxn: finalCompraMEX,
      venta_clp: finalVentaCLP,
      compra_clp: finalCompraCLP,
      venta_bs: finalVentaBS,
      compra_bs: finalCompraBS,

      // Backward compatibility (alias para código antiguo)
      cop: finalVentaCOP,
      mxn: finalVentaMEX,
      clp: finalVentaCLP,
      ves: finalVentaBS
    };
  }

  // Calcula _meta por juego (precio mínimo/máximo de venta en USD)
  for (const [gameId, servers] of Object.entries(result)) {
    const ventas = Object.values(servers)
      .filter(s => typeof s === 'object' && s.venta)
      .map(s => s.venta);
    if (!ventas.length) continue;
    result[gameId]._meta = {
      min_venta: Math.min(...ventas),
      max_venta: Math.max(...ventas),
    };
  }

  // Incluye tasas en el resultado (opcional, para debugging)
  result._rates = rates;

  cache = { data: result, ts: now };
  return result;
}

function invalidateCache() { cache.ts = 0; }

/**
 * Lee precios de WoW Gold desde pestaña WOW_GOLD (sin cambios)
 *
 * NOTA: Esta función mantiene su estructura anterior, pero se podría
 * actualizar también para usar tasas dinámicas si lo deseas.
 */
async function getWowPricesFromSheet() {
  if (!SHEET_ID) return {};
  const sheets = await api();

  try {
    const wowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_WOW_GOLD}!A2:L10`,
    });
    const wowRows = wowRes.data.values || [];
    const result = {};

    if (wowRows.length) {
      result['wow-retail'] = {};
      for (const row of wowRows) {
        const serverName = row[0]?.trim();
        const activo     = row[11]?.trim()?.toUpperCase();
        if (!serverName || activo === 'NO') continue;

        const compra = parseNum(row[1]);
        const venta  = parseNum(row[4]);
        const cop    = parseNum(row[5]);
        const ves    = parseNum(row[6]);
        const clp    = parseNum(row[7]);
        const mxn    = parseNum(row[8]);

        if (!venta) continue;
        result['wow-retail'][serverName] = { venta, compra, cop, ves, clp, mxn };
      }
    }
    return result;
  } catch (e) {
    console.warn('[Sheets] Error leyendo WOW_GOLD:', e.message);
    return {};
  }
}

/**
 * Registra una venta en la pestaña "📝 Ventas"
 * (Sin cambios en esta función)
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

/**
 * Registra un pedido en la pestaña "📝 Ventas"
 * (Sin cambios en esta función)
 */
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

/**
 * Lee reseñas desde pestaña "RESEÑAS"
 * (Sin cambios en esta función)
 */
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

/**
 * Suma las ventas del día actual desde la pestaña Ventas
 * (Sin cambios en esta función)
 */
async function getDailySalesStats() {
  if (!SHEET_ID) return { totalUSD: 0, count: 0 };
  const sheetsApi = await api();
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_VENTAS}!A4:I2000`,
  });
  const today = new Date().toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric', month: 'numeric', year: 'numeric',
  });
  let totalUSD = 0;
  let count = 0;
  for (const row of res.data.values || []) {
    if (!row[0]) continue;
    const rowDate = row[0].split(',')[0].trim();
    if (rowDate !== today) continue;
    const usd = parseFloat((row[8] || '').replace(/[^0-9.]/g, '')) || 0;
    totalUSD += usd;
    count++;
  }
  return { totalUSD, count };
}

module.exports = {
  getPricesFromSheet,
  getExchangeRates,
  getWowPricesFromSheet,
  getResenas,
  logSale,
  logOrder,
  invalidateCache,
  getDailySalesStats
};
