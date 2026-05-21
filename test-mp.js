require('dotenv').config();
const { MercadoPagoConfig, Preference } = require('mercadopago');
const fetch = require('node-fetch');

async function main() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) { console.error('ERROR: MP_ACCESS_TOKEN no definido en .env'); process.exit(1); }

  console.log(`Token tipo: ${token.startsWith('TEST-') ? 'SANDBOX' : 'PRODUCCIÓN'}`);
  console.log(`Token prefix: ${token.substring(0, 15)}...\n`);

  // Obtener tasa COP actual
  let copRate = 4200;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    copRate = d.rates?.COP || 4200;
    console.log(`Tasa COP/USD: ${copRate}`);
  } catch { console.log('No se pudo obtener tasa COP, usando 4200'); }

  const unitPriceCOP = Math.round(1 * 0.17 * copRate); // 1M Kamas Retro a $0.17/M
  console.log(`unit_price calculado: ${unitPriceCOP} COP\n`);

  const mpClient = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(mpClient);

  const body = {
    items: [{
      id: 'test-dofus-retro-1m',
      title: '1M Kamas - Dofus Retro',
      description: 'Servidor: Allisteria',
      quantity: 1,
      unit_price: unitPriceCOP,
      currency_id: 'COP',
    }],
    payer: { email: 'test@portalgamerslatam.com' },
    statement_descriptor: 'PORTAL GAMERS',
    external_reference: `test-${Date.now()}`,
    back_urls: {
      success: 'https://portalgamerslatam.com/gracias.html',
      failure: 'https://portalgamerslatam.com/?error=pago',
      pending: 'https://portalgamerslatam.com/gracias.html',
    },
    auto_return: 'approved',
    notification_url: 'https://portalgamerslatam.com/api/payments/webhook',
  };

  console.log('Enviando preferencia a MP:\n', JSON.stringify(body, null, 2), '\n');

  try {
    const result = await preference.create({ body });
    console.log('--- RESPUESTA MP ---');
    console.log('ID:', result.id);
    console.log('init_point:', result.init_point);
    console.log('sandbox_init_point:', result.sandbox_init_point);
    console.log('\n✓ TEST EXITOSO — el problema está en el frontend o en las variables de Railway');
    console.log('\nURL a abrir:\n', result.init_point);
  } catch (err) {
    console.error('--- ERROR MP ---');
    const detail = err.cause ?? err.error_response ?? err;
    console.error(JSON.stringify(detail, null, 2));
    console.error('\n✗ TEST FALLÓ — el token o la configuración de MP tiene problema');
    process.exit(1);
  }
}

main();
