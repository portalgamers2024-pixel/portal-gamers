require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // Create row 4 with clean values
  const row4 = [
    '',      // A: null
    '1',     // B: 1
    "'=",    // C: = as text (prefix with ')
    '22',    // D: 22
    "'=",    // E: = as text
    '3800',  // F: 3800
    '3700',  // G: 3700
    '1110',  // H: 1110
  ];

  console.log('Writing Row 4 with explicit values:');
  console.log(row4.map((v, i) => `${String.fromCharCode(65 + i)}:${v}`).join(', '));
  console.log();

  // Write using individual cell updates in a batch
  const requests = [];
  const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let i = 0; i < row4.length; i++) {
    const cell = colLabels[i] + '4';
    requests.push({
      range: `💰 Precios!${cell}`,
      values: [[row4[i]]],
    });
  }

  // Update all cells
  for (const req of requests) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: req.range,
        valueInputOption: 'USER_ENTERED',  // USER_ENTERED to handle text formatting
        requestBody: { values: req.values },
      });
    } catch (e) {
      console.log(`  ❌ ${req.range}: ${e.message}`);
    }
  }
  console.log('  ✅ All cells written');

  // Verify
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!A4:H4`,
  });
  const verified = verify.data.values?.[0] || [];
  console.log(`\nVerified:`);
  console.log(verified.slice(0, 8).map((v, i) => `${String.fromCharCode(65 + i)}:${v ?? '(empty)'}`).join(', '));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
