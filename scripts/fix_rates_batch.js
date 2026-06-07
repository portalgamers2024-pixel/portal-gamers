require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('Writing exchange rates using batchUpdate...\n');

  // Use batchUpdate to write individual cells
  const requests = [
    {
      update_cells: {
        range: { sheet_id: 0, row_index: 3, column_index: 3, end_column_index: 4 },  // D4
        rows: [{ values: [{ user_entered_value: { number_value: 22 } }] }],
        fields: 'user_entered_value'
      }
    },
    {
      update_cells: {
        range: { sheet_id: 0, row_index: 3, column_index: 5, end_column_index: 6 },  // F4
        rows: [{ values: [{ user_entered_value: { number_value: 3800 } }] }],
        fields: 'user_entered_value'
      }
    },
    {
      update_cells: {
        range: { sheet_id: 0, row_index: 3, column_index: 6, end_column_index: 7 },  // G4
        rows: [{ values: [{ user_entered_value: { number_value: 3700 } }] }],
        fields: 'user_entered_value'
      }
    },
    {
      update_cells: {
        range: { sheet_id: 0, row_index: 3, column_index: 7, end_column_index: 8 },  // H4
        rows: [{ values: [{ user_entered_value: { number_value: 1110 } }] }],
        fields: 'user_entered_value'
      }
    }
  ];

  try {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests }
    });
    console.log('  ✅ Batch update succeeded');

    // Verify
    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!A4:I4`,
    });
    const row4 = verify.data.values?.[0] || [];
    console.log(`\nVerified Row 4:`);
    console.log(`  D4=${row4[3]}, F4=${row4[5]}, G4=${row4[6]}, H4=${row4[7]}`);
  } catch (e) {
    console.error('  ❌ Error:', e.message);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
