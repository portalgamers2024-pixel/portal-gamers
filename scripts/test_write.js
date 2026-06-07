require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // Try writing to a test cell
  console.log('Test 1: Writing to Z4...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!Z4`,
    valueInputOption: 'RAW',
    requestBody: { values: [['TEST_VALUE']] },
  });
  console.log('  Wrote "TEST_VALUE" to Z4');

  // Read it back
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!Z4`,
  });
  console.log(`  Read back: ${check.data.values?.[0]?.[0] ?? '(empty)'}`);

  console.log('\nTest 2: Writing to D4:H4 as a range...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!D4:H4`,
    valueInputOption: 'RAW',
    requestBody: { values: [[22, 'ignore', 3800, 3700, 1110]] },
  });
  console.log('  Wrote [22, ..., 3800, 3700, 1110] to D4:H4');

  // Read back D4:H4
  const check2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!D4:H4`,
  });
  console.log(`  Read back D4:H4: ${(check2.data.values?.[0] || []).join(' | ')}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
