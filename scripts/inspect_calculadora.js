require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const calc = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `💰 Precios!A1:AL41`,
  });

  const rows = calc.data.values || [];

  console.log('=== CALCULADORA Structure ===\n');

  // Show rows 1-10 with all columns to understand layout
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] || [];
    console.log(`Row ${i + 1}:`);
    for (let j = 0; j < Math.min(30, row.length); j++) {
      const col = String.fromCharCode(65 + j);
      const val = row[j];
      if (val) console.log(`  ${col}: ${val}`);
    }
    console.log();
  }

  // Count non-empty cells by column
  console.log('\n=== Column Usage (first 20 columns) ===');
  for (let j = 0; j < 20; j++) {
    const col = String.fromCharCode(65 + j);
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][j]) count++;
    }
    if (count > 0) console.log(`  ${col}: ${count} values`);
  }

  // Find game section headers
  console.log('\n=== Potential Game Headers ===');
  const gameKeywords = ['DOFUS', 'ALBION', 'WAKFU', 'WOW'];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toUpperCase();
      if (gameKeywords.some(kw => cell.includes(kw))) {
        const col = String.fromCharCode(65 + j);
        console.log(`  Row ${i + 1}, ${col}: ${row[j]}`);
      }
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
