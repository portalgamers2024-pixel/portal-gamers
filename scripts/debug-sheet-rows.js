require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SHEET_ID = process.env.SHEET_ID;
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function debug() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A5:K25',
  });

  console.log('📋 Raw rows from 💰 Precios (A5:K25):\n');
  const rows = res.data.values || [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 5;
    console.log(`Row ${rowNum}:`, row);
  });
}

debug().catch(console.error);
