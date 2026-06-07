require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  console.log('=== LIVE GOOGLE SHEET TABS ===\n');
  for (const s of meta.data.sheets) {
    const p = s.properties;
    console.log(`- "${p.title}"  (sheetId=${p.sheetId}, rows=${p.gridProperties.rowCount}, cols=${p.gridProperties.columnCount})`);
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
