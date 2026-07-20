const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

// Pestaña "💰 Precios": datos desde fila 6 (después de headers en fila 5)
// Headers (fila 5):
//   A=JUEGO, B=SERVIDOR
//   C=COMPRA USD, D=COMPRA BS, E=COMPRA COP
//   F=VENTA USD, G=VENTA MEX, H=VENTA CLP, I=VENTA BS, J=VENTA COP
//   K=ESTADO
// Tasas desde fila 5 (intercambio dinámico):
//   P5=Compra MEX, Q5=Compra CLP, R5=Compra COP, S5=Compra Bs
//   T5=Venta MEX,  U5=Venta CLP,  V5=Venta COP,  W5=Venta Bs

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
 * Lee desde CALCULADORA y STOCKS en la nueva estructura migrada.
 * Tasas vienen desde getExchangeRates() que lee desde ⚙️ Configuracion.
 */
async function getPricesFromSheet() {
  if (!SHEET_ID) return null;
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) return cache.data;

  const sheets = await api();
  const rates = await getExchangeRates();

  // Lee CALCULADORA: estructura con bloques horizontales
  const calc = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB_PRECIOS}!A1:AL41`,
  });

  // Lee STOCKS para ESTADO COMPRA y ESTADO VENTA
  const stocks = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `Stock Y Cuentas!A1:K100`,
  });

  const calcRows = calc.data.values || [];
  const stockRows = stocks.data.values || [];

  // Build server->estado map from STOCKS
  // A=servidor, J=ESTADO COMPRA (DISPONIBLE/FULL STOCK), K=ESTADO VENTA (DISPONIBLE/STOCK AGOTADO)
  const estadoMap = {};
  for (let i = 2; i < stockRows.length; i++) {
    const row = stockRows[i] || [];
    const server = row[0] && String(row[0]).trim();
    const estadoCompra = row[9] && String(row[9]).trim();
    const estadoVenta = row[10] && String(row[10]).trim();
    if (server) {
      estadoMap[server.toUpperCase()] = {
        estado_compra: estadoCompra || 'DISPONIBLE',
        estado_venta: estadoVenta || 'DISPONIBLE'
      };
    }
  }

  const result = {};
  let currentGame = null;

  // Row 5: Game headers (B=DOFUS, Q=ALBION, etc)
  // Row 6: Section headers (B=COMPRA, F=VENTA, etc)
  // Row 7: Column headers (B=Servidor, D=USDT, J=USDT, etc)
  // Row 8+: Data rows por juego

  // Process rows starting from row 8 (after headers)
  for (let i = 7; i < calcRows.length; i++) {
    const row = calcRows[i] || [];
    const colB = row[1] ? String(row[1]).trim() : '';
    const colQ = row[16] ? String(row[16]).trim() : '';

    // Detect game header rows (all-caps game names, no prices)
    if (colB && colB.toUpperCase() === colB && !parseNum(row[3])) {
      const mapped = Object.entries(GAME_NAME_MAP).find(([k]) => colB.toUpperCase().includes(k));
      if (mapped) {
        currentGame = mapped[1];
      }
      continue;
    }

    // DOFUS family block (left side): cols B-L
    // B=Servidor, D=USDT(compra), J=USDT(venta), G=COP(venta), K=BS(venta)
    if (currentGame && colB && !colB.startsWith('COMPRA') && !colB.startsWith('VENTA') && !colB.match(/^[0-9,]+$/)) {
      const compraUSD = parseNum(row[3]);  // D
      const ventaUSD = parseNum(row[9]);   // J

      if (compraUSD > 0 || ventaUSD > 0) {
        const serverName = colB;
        const ventaCOP = parseNum(row[6]);   // G
        const ventaBS = parseNum(row[10]);   // K

        if (!result[currentGame]) result[currentGame] = {};
        const serverEstado = estadoMap[serverName.toUpperCase()] || { estado_compra: 'DISPONIBLE', estado_venta: 'DISPONIBLE' };
        result[currentGame][serverName] = {
          venta_usd: ventaUSD,
          compra_usd: compraUSD,
          venta_cop: ventaCOP || (ventaUSD * rates.venta.cop),
          compra_cop: compraUSD * rates.compra.cop,
          venta_mex: ventaUSD * rates.venta.mex,
          compra_mex: compraUSD * rates.compra.mex,
          venta_clp: ventaUSD * rates.venta.clp,
          compra_clp: compraUSD * rates.compra.clp,
          venta_bs: ventaBS || (ventaUSD * rates.venta.bs),
          compra_bs: compraUSD * rates.compra.bs,
          estado_compra: serverEstado.estado_compra,
          estado_venta: serverEstado.estado_venta,
          estado: serverEstado.estado_venta,
          // Backward compat
          venta: ventaUSD,
          compra: compraUSD,
          cop: ventaCOP || (ventaUSD * rates.venta.cop),
          mxn: ventaUSD * rates.venta.mex,
          clp: ventaUSD * rates.venta.clp,
          ves: ventaBS || (ventaUSD * rates.venta.bs),
        };
      }
    }

    // ALBION block (right side): cols Q-Z (regions: BINANCE, COLOMBIA, VENEZUELA, CHILE)
    // Q=Region, T=Compra USDT, Z=Venta USDT
    if (colQ && colQ !== 'COMPRA' && colQ !== 'VENTA' && colQ !== 'BINANCE' && !colQ.match(/^[0-9,]+$/)) {
      const compraUSD = parseNum(row[19]);  // T
      const ventaUSD = parseNum(row[25]);   // Z

      if (compraUSD > 0 || ventaUSD > 0) {
        if (!result['albion']) result['albion'] = {};
        const serverEstado = estadoMap[colQ.toUpperCase()] || { estado_compra: 'DISPONIBLE', estado_venta: 'DISPONIBLE' };
        result['albion'][colQ] = {
          venta_usd: ventaUSD,
          compra_usd: compraUSD,
          venta_cop: ventaUSD * rates.venta.cop,
          compra_cop: compraUSD * rates.compra.cop,
          venta_mex: ventaUSD * rates.venta.mex,
          compra_mex: compraUSD * rates.compra.mex,
          venta_clp: ventaUSD * rates.venta.clp,
          compra_clp: compraUSD * rates.compra.clp,
          venta_bs: ventaUSD * rates.venta.bs,
          compra_bs: compraUSD * rates.compra.bs,
          estado_compra: serverEstado.estado_compra,
          estado_venta: serverEstado.estado_venta,
          estado: serverEstado.estado_venta,
          // Backward compat
          venta: ventaUSD,
          compra: compraUSD,
          cop: ventaUSD * rates.venta.cop,
          mxn: ventaUSD * rates.venta.mex,
          clp: ventaUSD * rates.venta.clp,
          ves: ventaUSD * rates.venta.bs,
        };
      }
    }
  }

  // Calcula _meta por juego
  for (const [gameId, servers] of Object.entries(result)) {
    const ventas = Object.values(servers)
      .filter(s => typeof s === 'object' && s.venta)
      .map(s => s.venta);
    if (ventas.length) {
      result[gameId]._meta = {
        min_venta: Math.min(...ventas),
        max_venta: Math.max(...ventas),
      };
    }
  }

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
