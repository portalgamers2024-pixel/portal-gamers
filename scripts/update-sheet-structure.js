const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function getSheetData() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Read "💰 Precios" tab
  const preciosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A1:J10',
  });
  console.log('=== 💰 Precios (A1:J10) ===');
  console.log(preciosRes.data.values);
  console.log('\n');

  // Read "🚀 Registro Rápido" tab
  const registroRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '🚀 Registro Rápido!A1:J20',
  });
  console.log('=== 🚀 Registro Rápido (A1:J20) ===');
  console.log(registroRes.data.values);
}

getSheetData().catch(console.error);
