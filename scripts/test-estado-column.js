const sheets = require('../sheets');

async function test() {
  console.log('📝 Testing getPricesFromSheet()...\n');
  try {
    const prices = await sheets.getPricesFromSheet();

    // Show first game and its servers
    const firstGame = Object.keys(prices).find(k => !k.startsWith('_'));
    if (firstGame) {
      console.log(`Game: ${firstGame}`);
      console.log(`Servers:${Object.keys(prices[firstGame]).slice(0, 5).map(s => `\n  - ${s}:`).join('')}`);

      const firstServer = Object.keys(prices[firstGame]).find(k => k !== '_meta');
      if (firstServer) {
        const serverData = prices[firstGame][firstServer];
        console.log(`\n\nFirst server data (${firstServer}):`);
        console.log(JSON.stringify(serverData, null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
