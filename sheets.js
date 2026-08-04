const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets'];

// Pestaña "💰 Precios", bloque DOFUS (cols B-L, compartido por Dofus Touch/3.0/
// Retro/Wakfu/Albion): cada moneda se lee tal cual de su columna, sin conversión.
//   Compra: C=COP, D=USDT, E=BS   (no hay columnas de compra en MEX ni CLP)
//   Venta:  G=COP, H=MEX, I=CLP, J=USDT, K=BS

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

// Lee el valor crudo de una celda de moneda, sin calcular ni convertir nada.
// Retorna null si la celda está vacía o contiene texto no numérico (ej. "NO SE
// COMPRA"), en vez de 0 o un valor calculado — así se distingue "no disponible"
// de "el precio es cero".
function readCellValue(raw) {
  const s = raw ? String(raw).trim() : '';
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  return parseNum(s);
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
 * getPricesFromSheet()
 * Lee precios y estado desde "💰 Precios" y "Stock Y Cuentas". Cada moneda se
 * lee tal cual de su columna en el Sheet — no hay ninguna conversión ni cálculo.
 */
async function getPricesFromSheet() {
  if (!SHEET_ID) return null;
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) return cache.data;

  const sheets = await api();

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
  let currentGame = 'dofus-touch'; // el encabezado "DOFUS TOUCH" (fila 5) queda antes del rango que lee el loop (arranca en fila 8 = Blair); las primeras filas de datos son siempre Dofus Touch

  // Row 5: Game headers (B=DOFUS, Q=ALBION, etc)
  // Row 6: Section headers (B=COMPRA, F=VENTA, etc)
  // Row 7: Column headers (B=Servidor, D=USDT, J=USDT, etc)
  // Row 8+: Data rows por juego

  // Process rows starting from row 8 (after headers)
  for (let i = 7; i < calcRows.length; i++) {
    const row = calcRows[i] || [];
    const colB = row[1] ? String(row[1]).trim() : '';

    // Detect game header rows (all-caps game names, celda de precio C vacía).
    // OJO: se usa "sin nada escrito en C" en vez de "precio D parsea a 0", porque
    // una fila de datos real puede tener precio 0 (ej. WOW RETAIL, que aún no
    // tiene precios cargados) y no debe confundirse con un encabezado de sección.
    if (colB && colB.toUpperCase() === colB && !row[2]) {
      const mapped = Object.entries(GAME_NAME_MAP).find(([k]) => colB.toUpperCase().includes(k));
      if (mapped) {
        currentGame = mapped[1];
      }
      continue;
    }

    // DOFUS family block (left side): cols B-L — compartido por Dofus Touch/3.0/
    // Retro/Wakfu/Albion. Compra: C=COP, D=USDT, E=BS. Venta: G=COP, H=MEX, I=CLP,
    // J=USDT, K=BS. No hay columnas de compra en MEX/CLP — quedan en null.
    if (currentGame && colB && !colB.startsWith('COMPRA') && !colB.startsWith('VENTA') && !colB.match(/^[0-9,]+$/)) {
      const compraUSD = parseNum(row[3]);  // D
      const ventaUSD = parseNum(row[9]);   // J
      const serverName = colB;
      // Si el precio está en 0 en ambos lados pero hay un estado real configurado
      // en "Stock Y Cuentas" (ej. WOW RETAIL, que aún no tiene precios cargados),
      // no descartamos la fila — igual necesitamos reflejar ese estado en el sitio.
      const serverEstadoLookup = estadoMap[serverName.toUpperCase()];

      if (compraUSD > 0 || ventaUSD > 0 || serverEstadoLookup) {
        const compraCOP = parseNum(row[2]);      // C
        const compraBS  = parseNum(row[4]);      // E
        const ventaCOP  = readCellValue(row[6]);  // G
        const ventaMEX  = readCellValue(row[7]);  // H
        const ventaCLP  = readCellValue(row[8]);  // I
        const ventaBS   = readCellValue(row[10]); // K

        if (!result[currentGame]) result[currentGame] = {};
        const serverEstado = serverEstadoLookup || { estado_compra: 'DISPONIBLE', estado_venta: 'DISPONIBLE' };
        result[currentGame][serverName] = {
          venta_usd: ventaUSD,
          compra_usd: compraUSD,
          venta_cop: ventaCOP,
          compra_cop: compraCOP,
          venta_mex: ventaMEX,
          compra_mex: null, // no existe columna COMPRA MEX en el Sheet
          venta_clp: ventaCLP,
          compra_clp: null, // no existe columna COMPRA CLP en el Sheet
          venta_bs: ventaBS,
          compra_bs: compraBS,
          estado_compra: serverEstado.estado_compra,
          estado_venta: serverEstado.estado_venta,
          estado: serverEstado.estado_venta,
          // Backward compat
          venta: ventaUSD,
          compra: compraUSD,
          cop: ventaCOP,
          mxn: ventaMEX,
          clp: ventaCLP,
          ves: ventaBS,
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
  getWowPricesFromSheet,
  getResenas,
  logSale,
  logOrder,
  invalidateCache,
  getDailySalesStats
};
