const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function checkFormulas() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get all data including formulas
  const registroRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '🚀 Registro Rápido!A1:J20',
    valueRenderOption: 'FORMULA',
  });

  console.log('=== 🚀 Registro Rápido — FÓRMULAS (A1:J20) ===\n');
  const values = registroRes.data.values || [];
  values.forEach((row, idx) => {
    console.log(`Fila ${idx + 1}:`);
    row.forEach((cell, colIdx) => {
      const col = String.fromCharCode(65 + colIdx);
      if (cell && cell.toString().includes('=')) {
        console.log(`  ${col}: ${cell}`);
      }
    });
  });
}

checkFormulas().catch(console.error);
