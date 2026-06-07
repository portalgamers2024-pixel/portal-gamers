require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // Row 4 tasas: B4=1, D4=22, F4=3800, G4=3700, H4=1110
  // Send as individual cells to avoid row-length issues
  const updates = [
    { range: '💰 Precios!D4', values: [[22]] },
    { range: '💰 Precios!F4', values: [[3800]] },
    { range: '💰 Precios!G4', values: [[3700]] },
    { range: '💰 Precios!H4', values: [[1110]] },
  ];

  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: update.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: update.values },
    });
    console.log(`  ✅ ${update.range} = ${update.values[0][0]}`);
  }
  console.log('Row 4 (tasas) fixed');
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
