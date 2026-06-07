require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const migration = require('../data/migration.json');
  const row4 = migration.tabs['CALCULADORA'].values[3];  // Row 4 (0-indexed)

  console.log('Original Row 4 from migration.json:');
  console.log(row4.slice(0, 15).map((v, i) => `${String.fromCharCode(65 + i)}:${v}`).join(', '));
  console.log();

  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Writing full Row 4 to Google Sheet...');

  // Write the entire row 4
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!A4`,
    valueInputOption: 'RAW',
    requestBody: { values: [row4.slice(0, 20)] },  // Write first 20 columns
  });
  console.log('  ✅ Row 4 written');

  // Verify
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!A4:H4`,
  });
  const verified = verify.data.values?.[0] || [];
  console.log(`\nVerified:`);
  console.log(verified.slice(0, 8).map((v, i) => `${String.fromCharCode(65 + i)}:${v}`).join(', '));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
