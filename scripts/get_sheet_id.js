require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });

  console.log('Sheet tabs and their IDs:\n');
  metadata.data.sheets.forEach(sheet => {
    console.log(`  "${sheet.properties.title}" → sheetId: ${sheet.properties.sheetId}`);
  });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
