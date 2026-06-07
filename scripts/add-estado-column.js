const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function addEstadoColumn() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // First, read the current data to see how many rows have servers
  const preciosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A1:J100',
  });

  const rows = preciosRes.data.values || [];
  console.log(`Total rows in Precios: ${rows.length}`);

  // Find where the data starts (row 5 in 0-indexed = row 6 in 1-indexed)
  // and count servers
  let firstServerRow = -1;
  let lastServerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] && !row[0].toString().includes('TABLA') && i >= 4) {
      if (firstServerRow === -1) firstServerRow = i + 1; // Convert to 1-indexed
      // Check if it's a server name (row[1] exists and is not empty)
      if (row[1] && row[1].toString().trim()) {
        lastServerRow = i + 1;
      }
    }
  }

  console.log(`Servers data: rows ${firstServerRow} to ${lastServerRow}`);

  // Add ESTADO header in column K (column 11)
  console.log('\n📝 Adding ESTADO header...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!K5',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['ESTADO']],
    },
  });
  console.log('✅ Header added at K5');

  // Add "Disponible" for all server rows
  if (lastServerRow > firstServerRow) {
    const estadoValues = [];
    for (let i = firstServerRow; i <= lastServerRow; i++) {
      estadoValues.push(['Disponible']);
    }

    const numRows = estadoValues.length;
    console.log(`\n📝 Adding "Disponible" to ${numRows} rows (K${firstServerRow}:K${lastServerRow})...`);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `💰 Precios!K${firstServerRow}:K${lastServerRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: estadoValues,
      },
    });
    console.log(`✅ Added "Disponible" to ${numRows} rows`);
  }

  console.log('\n✅ Columna ESTADO agregada exitosamente');
}

addEstadoColumn().catch(console.error);
