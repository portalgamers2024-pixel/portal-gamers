const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function checkDataValidation() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get sheet metadata with data validations
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const registroSheet = spreadsheet.data.sheets.find(s => s.properties.title === '🚀 Registro Rápido');

  if (registroSheet && registroSheet.data && registroSheet.data[0]) {
    const dataValidation = registroSheet.data[0].dataValidation || [];
    console.log('=== DATA VALIDATION EN "🚀 Registro Rápido" ===\n');
    dataValidation.forEach(dv => {
      console.log(`Rango: ${dv.ranges.map(r => `${r.sheetId}:${r.startRowIndex}-${r.endRowIndex},${r.startColumnIndex}-${r.endColumnIndex}`).join(', ')}`);
      if (dv.criteria.formulaUnprotectedRange) {
        console.log(`  Criterio: CUSTOM FORMULA: ${dv.criteria.formulaUnprotectedRange}`);
      } else if (dv.criteria.condition) {
        console.log(`  Criterio: ${JSON.stringify(dv.criteria)}`);
      }
      console.log();
    });
  }

  // Also check merged cells
  console.log('=== MERGED CELLS ===\n');
  if (registroSheet && registroSheet.merges) {
    registroSheet.merges.forEach(merge => {
      console.log(`Merged: ${merge.sheetId} (rows ${merge.startRowIndex}-${merge.endRowIndex}, cols ${merge.startColumnIndex}-${merge.endColumnIndex})`);
    });
  }
}

checkDataValidation().catch(console.error);
