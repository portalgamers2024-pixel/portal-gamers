const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function updateFormulas() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Formulas to update:
  // C9: VENTA - Precio/M USD (COMPRA USD)
  // F9: COMPRA - Precio compra/M USD (COMPRA USD)
  // I9: INTERCAMBIO - Precio compra origen/M (VENTA USD del origen)
  // F12: COMPRA - Precio venta/M USD (VENTA USD)
  // I11: INTERCAMBIO - Precio venta destino/M (VENTA USD del destino)
  // I13: INTERCAMBIO - Costo nuestro destino (VENTA USD del destino)

  const updates = [
    {
      range: '🚀 Registro Rápido!C9',
      values: [['=IFERROR(VLOOKUP(C5,\'💰 Precios\'!$B:$J,6,0),0)']],
      note: 'VENTA - Precio/M USD (VENTA USD desde Precios columna F=6)'
    },
    {
      range: '🚀 Registro Rápido!F9',
      values: [['=IFERROR(VLOOKUP(F5,\'💰 Precios\'!$B:$J,2,0),0)']],
      note: 'COMPRA - Precio compra/M USD (COMPRA USD desde Precios columna C=2)'
    },
    {
      range: '🚀 Registro Rápido!I9',
      values: [['=IFERROR(VLOOKUP(I5,\'💰 Precios\'!$B:$J,6,0),0)']],
      note: 'INTERCAMBIO - Precio compra origen/M (VENTA USD desde Precios columna F=6)'
    },
    {
      range: '🚀 Registro Rápido!F12',
      values: [['=IFERROR(VLOOKUP(F5,\'💰 Precios\'!$B:$J,6,0),0)']],
      note: 'COMPRA - Precio venta/M USD (VENTA USD desde Precios columna F=6)'
    },
    {
      range: '🚀 Registro Rápido!I11',
      values: [['=IFERROR(VLOOKUP(I7,\'💰 Precios\'!$B:$J,6,0),0)']],
      note: 'INTERCAMBIO - Precio venta destino/M (VENTA USD desde Precios columna F=6)'
    },
    {
      range: '🚀 Registro Rápido!I13',
      values: [['=IFERROR(I12*VLOOKUP(I7,\'💰 Precios\'!$B:$J,6,0),0)']],
      note: 'INTERCAMBIO - Costo nuestro destino'
    },
  ];

  console.log('🔄 Actualizando fórmulas en "🚀 Registro Rápido"...\n');

  for (const update of updates) {
    console.log(`Actualizando: ${update.range}`);
    console.log(`  ${update.note}`);
    console.log(`  Nueva fórmula: ${update.values[0][0]}\n`);

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: update.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: update.values,
        },
      });
      console.log('  ✅ Actualizado\n');
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ Actualización completada');
}

updateFormulas().catch(console.error);
