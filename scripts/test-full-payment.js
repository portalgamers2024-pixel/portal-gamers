require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MercadoPagoConfig, Preference } = require('mercadopago');
const fetch = require('node-fetch');

async function main() {
  const token = process.env.TEST_ACCESS_TOKEN;
  if (!token || token === 'PENDIENTE_VER_INSTRUCCIONES') {
    console.error('ERROR: TEST_ACCESS_TOKEN no está configurado en .env');
    console.error('');
    console.error('Pasos para obtenerlo:');
    console.error('1. Abre https://www.mercadopago.com.co en modo incógnito');
    console.error('2. Inicia sesión con:');
    console.error('   Email:    ' + (process.env.TEST_SELLER_EMAIL || 'ver scripts/test-users.json → seller.email'));
    console.error('   Password: ' + (process.env.TEST_SELLER_PASSWORD || 'ver scripts/test-users.json → seller.password'));
    console.error('3. Ve a https://www.mercadopago.com.co/developers/panel');
    console.error('4. Copia el "Access Token" de Credenciales de prueba (empieza con TEST-)');
    console.error('5. Agrega a .env: TEST_ACCESS_TOKEN=TEST-...');
    process.exit(1);
  }

  const buyerEmail = process.env.TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    console.error('ERROR: TEST_BUYER_EMAIL no está configurado en .env');
    process.exit(1);
  }

  // Obtener tasa COP
  let copRate = 4200;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    copRate = d.rates?.COP || 4200;
  } catch { /* usar fallback */ }

  const unitPrice = Math.round(1 * 0.17 * copRate);
  console.log(`Token: ${token.substring(0, 20)}...`);
  console.log(`Tasa COP: ${copRate} → unit_price: ${unitPrice} COP`);
  console.log(`Payer email: ${buyerEmail}\n`);

  const mpClient = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(mpClient);

  const body = {
    items: [{
      id: 'test-1m-kamas-retro',
      title: '1M Kamas - Dofus Retro',
      description: 'Servidor: Allisteria',
      quantity: 1,
      unit_price: unitPrice,
      currency_id: 'COP',
    }],
    payer: { email: buyerEmail },
    statement_descriptor: 'PORTAL GAMERS',
    external_reference: `test-${Date.now()}`,
    back_urls: {
      success: 'https://portalgamerslatam.com/gracias.html',
      failure: 'https://portalgamerslatam.com/?error=pago',
      pending: 'https://portalgamerslatam.com/gracias.html',
    },
    auto_return: 'approved',
  };

  console.log('Enviando preferencia...\n');

  try {
    const result = await preference.create({ body });
    console.log('─── RESULTADO ───');
    console.log('preference.id:           ', result.id);
    console.log('init_point:              ', result.init_point);
    console.log('sandbox_init_point:      ', result.sandbox_init_point);
    console.log('');
    console.log('─── INSTRUCCIONES DE PRUEBA ───');
    console.log('Abre esta URL en una pestaña de incógnito:');
    console.log('  ', result.sandbox_init_point || result.init_point);
    console.log('');
    console.log('Inicia sesión con el COMPRADOR de prueba:');
    console.log('  Email:    ', process.env.TEST_BUYER_EMAIL);
    console.log('  Password: ', process.env.TEST_BUYER_PASSWORD);
    console.log('');
    console.log('Usa tarjeta de prueba Visa: 4013 5406 8274 6260');
    console.log('Vencimiento: 11/25  CVV: 123  Nombre: APRO');
  } catch (err) {
    console.error('─── ERROR MP ───');
    const detail = err.cause ?? err.error_response ?? err.message;
    console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
}

main();
