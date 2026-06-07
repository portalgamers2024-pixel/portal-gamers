require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));
const migration = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/migration.json'), 'utf8'));

// Order matters: upload CALCULADORA (-> 💰 Precios) first so formula refs resolve.
const ORDER = [
  'CALCULADORA', 'STOCKS', 'DOFUS', 'ALBION', 'WOW',
  'Formulado', 'Construccion 2', 'PUBLICACIONES', 'Streaming', 'Cuentas Paginas y demas',
];

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = {};
  for (const s of meta.data.sheets) existing[s.properties.title] = s.properties;

  // Phase 1: ensure each target tab exists with a grid big enough.
  const structRequests = [];
  const plan = [];
  for (const src of ORDER) {
    const tab = migration.tabs[src];
    if (!tab) { console.log(`  skip ${src} (not in migration)`); continue; }
    const target = tab.target;
    const needRows = Math.max(tab.values.length + 5, 30);
    const needCols = Math.max((tab.values[0] ? tab.values[0].length : 1) + 2, 12);
    plan.push({ src, target, needRows, needCols });

    if (existing[target]) {
      const gp = existing[target].gridProperties;
      if (gp.rowCount < needRows || gp.columnCount < needCols) {
        structRequests.push({
          updateSheetProperties: {
            properties: {
              sheetId: existing[target].sheetId,
              gridProperties: {
                rowCount: Math.max(gp.rowCount, needRows),
                columnCount: Math.max(gp.columnCount, needCols),
              },
            },
            fields: 'gridProperties.rowCount,gridProperties.columnCount',
          },
        });
      }
    } else {
      structRequests.push({
        addSheet: { properties: { title: target, gridProperties: { rowCount: needRows, columnCount: needCols } } },
      });
    }
  }

  if (structRequests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: structRequests } });
    console.log(`Structure: ${structRequests.length} create/resize ops applied\n`);
  }

  // Phase 2: clear + write each tab.
  const summary = [];
  for (const { src, target, needCols } of plan) {
    const tab = migration.tabs[src];
    const grid = tab.values.map(row => {
      const r = row.map(c => {
        if (c === null || c === undefined) return '';
        // Decorative lone "=" (or other invalid bare-operator cells) must be forced
        // to text, else USER_ENTERED treats them as broken formulas and corrupts the row.
        if (typeof c === 'string') {
          const t = c.trim();
          if (t === '=' || t === '==' || t === '+' || t === '-') return "'" + t;
        }
        return c;
      });
      while (r.length < (tab.values[0] ? tab.values[0].length : r.length)) r.push('');
      return r;
    });

    // Clear existing content in the target region
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${target}!A1:${colLetter(needCols + 5)}5000` });

    if (grid.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${target}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: grid },
      });
    }
    const cells = grid.reduce((s, r) => s + r.filter(x => x !== '').length, 0);
    summary.push({ target, rows: grid.length, cells });
    console.log(`  ${src} -> ${target}: wrote ${grid.length} rows, ${cells} non-empty cells`);
  }

  console.log('\n=== UPLOAD SUMMARY ===');
  for (const s of summary) console.log(`  ${s.target.padEnd(24)} ${String(s.rows).padStart(5)} rows  ${String(s.cells).padStart(6)} cells`);
}
main().catch(e => { console.error('ERROR:', e.message); if (e.errors) e.errors.forEach(x => console.error('  -', x.message)); process.exit(1); });
