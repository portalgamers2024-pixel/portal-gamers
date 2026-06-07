const sheets = require('../sheets');

async function test() {
  console.log('📝 Testing getPricesFromSheet()...\n');
  try {
    const prices = await sheets.getPricesFromSheet();
    console.log('✅ Success!\n');
    console.log(JSON.stringify(prices, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('❌ Error:', err);
    console.error('\nStack:', err.stack);
  }
}

test();
