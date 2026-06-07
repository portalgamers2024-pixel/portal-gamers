require('dotenv').config();
const sheets = require('../sheets.js');

async function test() {
  try {
    console.log('Testing getExchangeRates()...\n');
    const rates = await sheets.getExchangeRates();
    console.log('Exchange rates from ⚙️ Configuracion:');
    console.log(JSON.stringify(rates, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
