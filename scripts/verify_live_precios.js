require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `💰 Precios!A1:AL27`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const g = (r, c) => (rows[r-1] && rows[r-1][c-1] !== undefined) ? rows[r-1][c-1] : '';
  console.log('Left block (server, compraUSD D, ventaUSD J, ventaCOP G, ventaMEX H, ventaCLP I, ventaBS K):');
  for (let r = 5; r <= 25; r++) {
    const b = g(r,2);
    if (b === '' ) continue;
    console.log(`  R${r}: B=${b}  D=${g(r,4)}  J=${g(r,10)}  G=${g(r,7)}  H=${g(r,8)}  I=${g(r,9)}  K=${g(r,11)}`);
  }
  console.log('\nRight block (Q header, T compra, Z venta):');
  for (let r = 5; r <= 19; r++) {
    const q = g(r,17); // Q
    if (q === '') continue;
    console.log(`  R${r}: Q=${q}  T=${g(r,20)}  Z=${g(r,26)}`);
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
