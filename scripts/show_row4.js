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
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A4:Z4',
  });

  const row = res.data.values?.[0] || [];
  console.log('Current Row 4:');
  for (let i = 0; i < Math.min(26, row.length); i++) {
    const col = String.fromCharCode(65 + i);
    const val = row[i];
    console.log(`  ${col}: ${val ?? '(empty)'}`);
  }

  console.log('\nLooking for tasas...');
  console.log(`  Index 3 (D): ${row[3]}`);
  console.log(`  Index 5 (F): ${row[5]}`);
  console.log(`  Index 6 (G): ${row[6]}`);
  console.log(`  Index 7 (H): ${row[7]}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
