require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SHEET_ID = process.env.SHEET_ID;
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../sheets-key.json'), 'utf8'));

async function analyze() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '💰 Precios!A1:K50',
  });

  console.log('📋 Full 💰 Precios structure (A1:K50):\n');
  const rows = res.data.values || [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const summary = row.slice(0, 3).join(' | ');
    console.log(`Row ${rowNum.toString().padStart(2)}: ${summary}`);
  });
}

analyze().catch(console.error);
