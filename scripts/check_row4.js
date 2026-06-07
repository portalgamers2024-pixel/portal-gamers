require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const SHEET_ID = process.env.SHEET_ID;
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));
async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  for (const mode of ['FORMULA','UNFORMATTED_VALUE']) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `💰 Precios!A2:H8`, valueRenderOption: mode });
    console.log(`\n--- ${mode} ---`);
    (res.data.values||[]).forEach((row,i)=>console.log(`R${i+2}:`, JSON.stringify(row)));
  }
}
main().catch(e=>{console.error(e.message);process.exit(1);});
