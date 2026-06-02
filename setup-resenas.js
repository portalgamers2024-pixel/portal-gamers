const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID || '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';

let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} else {
  auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'sheets-key.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function setupResenas() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Delete existing tab if present
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets.find(s => s.properties.title === 'RESEÑAS');
  if (existing) {
    console.log(`Eliminando pestaña existente (ID: ${existing.properties.sheetId})...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: 'RESEÑAS' } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'RESEÑAS!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['Nombre', 'Reseña', 'Juego', 'Fecha', 'Estrellas'],
        ['Ivan Gomez Lopez', 'Súper recomendado 100% confiables', 'Portal Gamers', 'Mayo 2026', '5'],
        ['Eduardo Berasain', '100% confiables y rapido', 'Portal Gamers', 'Marzo 2026', '5'],
        ['Pabel Chaparro', '100% confiables y rápidos', 'Portal Gamers', 'Febrero 2026', '5'],
        ['Ovix Padron', 'Excelente servicio y atención. Pago rápido. Muy buen trato y eso que soy nuevo y no sabia mucho del proceso y me explico a muy amable. Lo recomiendo', 'Portal Gamers', 'Noviembre 2025', '5'],
        ['Darwin Jesus Calcurian', '100% confiable, rápido y efectiva.', 'Portal Gamers', 'Noviembre 2025', '5'],
      ],
    },
  });

  console.log('✅ Pestaña RESEÑAS creada con 5 reseñas.');
}

setupResenas().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
