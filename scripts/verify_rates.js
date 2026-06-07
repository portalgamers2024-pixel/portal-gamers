require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Reading Row 4 with different render options...\n');

  const ranges = [
    `💰 Precios!D4:H4`,
    `💰 Precios!A4:Z4`,
  ];

  for (const range of ranges) {
    console.log(`Range: ${range}`);

    // Try DEFAULT
    const def = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });
    console.log(`  DEFAULT: ${(def.data.values?.[0] || []).join(' | ')}`);

    // Try UNFORMATTED_VALUE
    const unfmt = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    console.log(`  UNFORMATTED_VALUE: ${(unfmt.data.values?.[0] || []).join(' | ')}`);

    console.log();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
