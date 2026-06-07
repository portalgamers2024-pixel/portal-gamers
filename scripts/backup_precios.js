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

  const tabs = ['💰 Precios', 'Stock Y Cuentas Base'];
  const backup = {};
  for (const t of tabs) {
    // both formulas and formatted values
    const [f, v] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${t}!A1:Z200`, valueRenderOption: 'FORMULA' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${t}!A1:Z200`, valueRenderOption: 'FORMATTED_VALUE' }),
    ]);
    backup[t] = { formulas: f.data.values || [], values: v.data.values || [] };
  }
  const outDir = path.join(__dirname, '../data');
  const stamp = '20260607';
  const outPath = path.join(outDir, `precios-backup-live-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log('Backup written to', outPath);
  for (const t of tabs) console.log(`  ${t}: ${backup[t].values.length} rows`);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
