require('dotenv').config();
const sheets = require('../sheets.js');

async function test() {
  console.log('Testing getPricesFromSheet() with new CALCULADORA structure...\n');
  try {
    const prices = await sheets.getPricesFromSheet();

    if (!prices) {
      console.log('❌ getPricesFromSheet() returned null');
      return;
    }

    // Show summary
    const games = Object.keys(prices).filter(k => !k.startsWith('_'));
    console.log(`✅ Found ${games.length} games:\n`);

    for (const game of games) {
      const servers = Object.keys(prices[game]).filter(k => k !== '_meta');
      const meta = prices[game]._meta || {};
      console.log(`  ${game}: ${servers.length} servers`);
      console.log(`    Price range (USD): $${meta.min_venta?.toFixed(2) || '?'} - $${meta.max_venta?.toFixed(2) || '?'}`);
      console.log(`    Servers: ${servers.slice(0, 3).join(', ')}${servers.length > 3 ? '...' : ''}\n`);
    }

    // Sample price detail
    if (prices['dofus-touch'] && prices['dofus-touch']['Blair']) {
      const blair = prices['dofus-touch']['Blair'];
      console.log('Sample: DOFUS Touch - Blair');
      console.log(`  venta_usd: $${blair.venta_usd}`);
      console.log(`  venta_cop: $${blair.venta_cop?.toFixed(0)}`);
      console.log(`  venta_bs: ${blair.venta_bs?.toFixed(2)}`);
      console.log(`  estado: ${blair.estado}\n`);
    }

    console.log('✅ Parser test PASSED');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  }
}

test();
