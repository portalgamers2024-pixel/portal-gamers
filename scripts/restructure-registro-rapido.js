require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function restructure() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  console.log('🔄 Reestructurando Registro Rápido...\n');

  // 1. Leer métodos de pago desde Precios B5:D5
  console.log('📊 Paso 1: Leyendo métodos de pago...');
  const metodosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!B5:D5',
  });

  const metodos = (metodosRes.data.values?.[0] || []).filter(m => m && m.trim());
  console.log(`  ✅ Métodos encontrados: ${metodos.join(', ')}\n`);

  // 2. Leer lista de servidores desde Precios A6:A100
  console.log('📊 Paso 2: Leyendo servidores...');
  const servidoresRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A6:A100',
  });

  const servidores = (servidoresRes.data.values || [])
    .map(r => r[0])
    .filter(s => s && s.trim() && !s.trim().startsWith('📈') && !s.trim().startsWith('MARGEN'))
    .map(s => s.trim());
  console.log(`  ✅ Servidores encontrados: ${servidores.length}`);
  console.log(`     ${servidores.slice(0, 5).join(', ')}...\n`);

  // 3. Obtener el ID de la pestaña
  console.log('📊 Paso 3: Obteniendo ID de la pestaña...');
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const registroSheet = spreadsheet.data.sheets.find(s => s.properties.title === '🚀 Registro Rápido');
  const sheetId = registroSheet?.properties.sheetId || 0;
  console.log(`  ✅ Sheet ID: ${sheetId}\n`);

  const requests = [];

  // 4a. Data Validation para Servidor (C5) - dropdown con servidores
  console.log('🔧 Paso 4a: Agregando validación para Servidor...');
  requests.push({
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: 4,
        endRowIndex: 17,
        startColumnIndex: 2,
        endColumnIndex: 3
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: servidores.map(s => ({ userEnteredValue: s }))
        },
        inputMessage: 'Selecciona un servidor de la lista',
        strict: true,
        showCustomUi: true
      }
    }
  });

  // 4b. Data Validation para Método de Pago (C7) - dropdown con métodos
  console.log('🔧 Paso 4b: Agregando validación para Método de Pago...');
  requests.push({
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: 6,
        endRowIndex: 7,
        startColumnIndex: 2,
        endColumnIndex: 3
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: metodos.map(m => ({ userEnteredValue: m }))
        },
        inputMessage: 'Selecciona un método de pago',
        strict: true,
        showCustomUi: true
      }
    }
  });

  // 5. Actualizar celdas usando values.update (más simple y confiable)
  console.log('🔧 Paso 5: Actualizando etiquetas...\n');

  const updateCells = [
    {
      range: '🚀 Registro Rápido!B9',
      values: [['💵 Precio/M']]
    },
    {
      range: '🚀 Registro Rápido!C9',
      values: [['']]
    },
    {
      range: '🚀 Registro Rápido!C10',
      values: [['']]
    },
    {
      range: '🚀 Registro Rápido!C11',
      values: [['']]
    },
    {
      range: '🚀 Registro Rápido!C12',
      values: [['']]
    }
  ];

  // 6. Ejecutar solicitudes
  console.log('⏳ Enviando cambios a Google Sheets...');
  try {
    // Primero las validaciones de datos
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: requests
        }
      });
      console.log('  ✅ Validaciones de datos agregadas');
    }

    // Luego las actualizaciones de valores
    for (const update of updateCells) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: update.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: update.values
        }
      });
    }
    console.log('  ✅ Celdas actualizadas\n');

    console.log('✅ ¡Reestructuración completada!\n');
    console.log('📋 Cambios realizados:');
    console.log('   ✅ Validación de Servidor - dropdown con servidores de Precios');
    console.log('   ✅ Validación de Método de Pago - dropdown con USD, BS, COP');
    console.log('   ✅ Etiqueta "Precio/M USD" → "Precio/M"');
    console.log('   ✅ Precio/M ahora es entrada manual (sin fórmula)');
    console.log('   ✅ Total USD, Total COP, Com. MP % - ELIMINADOS\n');

    console.log('📝 Próximos pasos:');
    console.log('   1. Abre el Google Sheet');
    console.log('   2. Verifica que los dropdowns funcionen correctamente');
    console.log('   3. Ingresa precios manualmente en el campo "Precio/M"');
    console.log('   4. Ajusta el Apps Script si es necesario\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.errors) {
      err.errors.forEach(e => console.error(`   - ${e.message}`));
    }
  }
}

restructure().catch(console.error);
