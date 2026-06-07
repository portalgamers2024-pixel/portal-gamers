require('dotenv').config();
const sheets = require('../sheets');

async function test() {
  console.log('SHEET_ID:', process.env.SHEET_ID);
  console.log('\n📝 Testing getPricesFromSheet()...\n');
  try {
    const prices = await sheets.getPricesFromSheet();
    if (!prices) {
      console.log('❌ getPricesFromSheet retornó null');
      return;
    }
    console.log('✅ Success!\n');

    // Find first game
    const games = Object.keys(prices).filter(k => !k.startsWith('_'));
    if (games.length) {
      const game = games[0];
      const servers = Object.keys(prices[game]).filter(k => k !== '_meta');
      if (servers.length) {
        const server = servers[0];
        console.log(`📊 Sample data - Game: ${game}, Server: ${server}`);
        console.log(JSON.stringify(prices[game][server], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }
}

test();
