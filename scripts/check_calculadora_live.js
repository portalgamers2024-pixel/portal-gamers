require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // Read CALCULADORA precios
  const calc = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `💰 Precios!A1:AL30`, valueRenderOption: 'UNFORMATTED_VALUE',
  });

  // Read STOCKS for estados
  const stocks = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `📦 Stock Y Cuentas!A1:K50`, valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const calcRows = calc.data.values || [];
  const stockRows = stocks.data.values || [];

  console.log('=== CALCULADORA tasas (row 4) ===');
  const r4 = calcRows[3] || [];
  console.log(`  B4=${r4[1]}, D4=${r4[3]}, F4=${r4[5]}, G4=${r4[6]}, H4=${r4[7]}`);

  console.log('\n=== CALCULADORA sample servidores (rows 8-12) ===');
  for (let i = 7; i <= 11 && i < calcRows.length; i++) {
    const row = calcRows[i] || [];
    console.log(`  R${i+1}: B=${row[1]} (juego) | D=${row[3]} (compra USD) | J=${row[9]} (venta USD) | G=${row[6]} (venta COP) | K=${row[10]} (venta BS)`);
  }

  console.log('\n=== STOCKS header y sample (rows 1-4) ===');
  for (let i = 0; i <= 3 && i < stockRows.length; i++) {
    const row = stockRows[i] || [];
    console.log(`  R${i+1}: A=${row[0]} | J=${row[9]} (ESTADO COMPRA) | K=${row[10]} (ESTADO VENTA)`);
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
