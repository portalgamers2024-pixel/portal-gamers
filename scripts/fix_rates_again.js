require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Writing exchange rates to CALCULADORA Row 4...\n');

  const updates = [
    { cell: 'D4', value: 22, label: 'MEX' },
    { cell: 'F4', value: 3800, label: 'COP COMPRA' },
    { cell: 'G4', value: 3700, label: 'COP VENTA' },
    { cell: 'H4', value: 1110, label: 'CHILE' },
  ];

  for (const update of updates) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `💰 Precios!${update.cell}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[update.value]] },
      });
      console.log(`  ✅ ${update.cell} (${update.label}) = ${update.value}`);
    } catch (e) {
      console.log(`  ❌ ${update.cell} failed: ${e.message}`);
    }
  }

  console.log('\nVerifying values...');
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!D4:H4`,
  });
  const row4 = verify.data.values?.[0] || [];
  console.log(`  D4=${row4[0]}, F4=${row4[2]}, G4=${row4[3]}, H4=${row4[4]}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
