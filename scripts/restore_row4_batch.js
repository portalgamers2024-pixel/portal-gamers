require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

const PRECIOS_SHEET_ID = 1590202415;  // 💰 Precios

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const cells = [
    { col: 3, val: 22, label: 'D4' },       // D = 3
    { col: 5, val: 3800, label: 'F4' },     // F = 5
    { col: 6, val: 3700, label: 'G4' },     // G = 6
    { col: 7, val: 1110, label: 'H4' },     // H = 7
  ];

  const requests = cells.map(({ col, val, label }) => ({
    updateCells: {
      range: {
        sheetId: PRECIOS_SHEET_ID,
        rowIndex: 3,  // Row 4 (0-indexed)
        columnIndex: col,
        endColumnIndex: col + 1,
      },
      rows: [
        {
          values: [
            {
              userEnteredValue: {
                numberValue: val,
              },
            },
          ],
        },
      ],
      fields: 'userEnteredValue',
    },
  }));

  console.log('Writing using batchUpdate with updateCells...');

  try {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
    console.log('  ✅ Batch update completed');

    // Verify
    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!A4:H4`,
    });
    const verified = verify.data.values?.[0] || [];
    console.log('\nVerified:');
    console.log(verified.slice(0, 8).map((v, i) => `${String.fromCharCode(65 + i)}:${v ?? '(empty)'}`).join(', '));
  } catch (e) {
    console.error('  ❌ Error:', e.message);
  }
}

main().catch(e => { console.error('FATAL ERROR:', e.message); process.exit(1); });
