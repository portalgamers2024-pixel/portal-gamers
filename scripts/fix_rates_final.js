require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Writing only numeric exchange rates to Row 4 (D, F, G, H)...\n');

  // Write just the numeric values
  const updates = [
    { cell: 'D4', value: 22, desc: 'MEX rate' },
    { cell: 'F4', value: 3800, desc: 'COP COMPRA rate' },
    { cell: 'G4', value: 3700, desc: 'COP VENTA rate' },
    { cell: 'H4', value: 1110, desc: 'CHILE rate' },
  ];

  for (const { cell, value, desc } of updates) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `💰 Precios!${cell}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[value]] },
      });
      console.log(`  ✅ ${cell} (${desc}) = ${value}`);
    } catch (e) {
      console.error(`  ❌ ${cell} error: ${e.message}`);
    }
  }

  // Wait a moment and verify
  await new Promise(r => setTimeout(r, 1000));

  console.log('\nVerifying...');
  try {
    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!A4:I4`,
    });
    const row = verify.data.values?.[0] || [];
    console.log(`  D4=${row[3] ?? '(empty)'}, F4=${row[5] ?? '(empty)'}, G4=${row[6] ?? '(empty)'}, H4=${row[7] ?? '(empty)'}`);
  } catch (e) {
    console.error(`  Error verifying: ${e.message}`);
  }
}

main().catch(e => { console.error('FATAL ERROR:', e.message); process.exit(1); });
