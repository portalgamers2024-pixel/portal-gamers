require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

const GAME_NAME_MAP = {
  'DOFUS': 'dofus-touch',
  'DOFUS 3': 'dofus-3',
  'DOFUS RETRO': 'dofus-retro',
  'WAKFU': 'wakfu',
  'ALBION': 'albion',
  'WOW': 'wow-retail',
};

function parseNum(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\./g, '').replace(',', '.').trim();
  return isNaN(parseFloat(s)) ? 0 : parseFloat(s);
}

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const calc = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!A1:AL41`,
  });

  const rows = calc.data.values || [];

  console.log('=== DETALLE DE PARSING ===\n');

  let currentGame = null;

  for (let i = 7; i < Math.min(40, rows.length); i++) {
    const row = rows[i] || [];
    const colB = row[1] ? String(row[1]).trim() : '';
    const colQ = row[16] ? String(row[16]).trim() : '';

    // Detecta headers de juegos
    if (colB && colB.toUpperCase() === colB && !parseNum(row[3])) {
      const mapped = Object.entries(GAME_NAME_MAP).find(([k]) => colB.toUpperCase().includes(k));
      if (mapped) {
        currentGame = mapped[1];
        console.log(`\n=== NEW GAME: ${currentGame} (from "${colB}") ===`);
      }
      continue;
    }

    // DOFUS family servers
    if (currentGame && colB && !colB.startsWith('COMPRA') && !colB.startsWith('VENTA') && !colB.match(/^[0-9,]+$/)) {
      const D = row[3];
      const J = row[9];
      const compraUSD = parseNum(D);
      const ventaUSD = parseNum(J);

      if (compraUSD > 0 || ventaUSD > 0) {
        console.log(`  ${colB}: D(compra)=${D}→${compraUSD.toFixed(2)}, J(venta)=${J}→${ventaUSD.toFixed(2)}`);
      }
    }

    // ALBION servers
    if (colQ && colQ !== 'COMPRA' && colQ !== 'VENTA' && colQ !== 'BINANCE' && !colQ.match(/^[0-9,]+$/)) {
      const T = row[19];
      const Z = row[25];
      const compraUSD = parseNum(T);
      const ventaUSD = parseNum(Z);

      if (compraUSD > 0 || ventaUSD > 0) {
        console.log(`  ALBION/${colQ}: T(compra)=${T}→${compraUSD.toFixed(2)}, Z(venta)=${Z}→${ventaUSD.toFixed(2)}`);
      }
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
