require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Writing exchange rates to Row 4...\n');

  // Write row 4 with all data from migration
  const row4 = [null, 1, '=', 22, '=', 3800, 3700, 1110];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!A4:H4`,
      valueInputOption: 'RAW',  // Use RAW to avoid formula interpretation
      requestBody: { values: [row4] },
    });
    console.log('  ✅ Row 4 written');

    // Verify immediately
    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!D4:H4`,
    });
    const verifyRow = verify.data.values?.[0] || [];
    console.log(`\nVerified: D4=${verifyRow[0]}, F4=${verifyRow[2]}, G4=${verifyRow[3]}, H4=${verifyRow[4]}`);
  } catch (e) {
    console.error('  ❌ Error:', e.message);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
