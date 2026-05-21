require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fetch = require('node-fetch');

const SITE = 'https://portalgamerslatam.com';
const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'TESTUSER3305823804284813263@testuser.com';
const BUYER_PASS  = process.env.TEST_BUYER_PASSWORD || 'fNKcGHUBTV';

async function main() {
  console.log(`Verificando flujo de pago en: ${SITE}\n`);

  let res, data;
  try {
    res = await fetch(`${SITE}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          productId: 'test-dofus-retro-allisteria-1',
          gameId: 'dofus-retro',
          name: '1M Kamas - Dofus Retro',
          server: 'Allisteria',
          price_usd: 0.17,
          quantity: 1,
        }],
        payer: { email: BUYER_EMAIL },
      }),
    });
    data = await res.json();
  } catch (err) {
    console.error('ERROR de red:', err.message);
    process.exit(1);
  }

  if (!res.ok || data.error) {
    console.error(`ERROR ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const sandboxUrl = data.sandbox_init_point;
  const initUrl    = data.init_point;

  console.log('─── RESPUESTA DEL SERVIDOR ───');
  console.log('preference_id:       ', data.preference_id);
  console.log('sandbox:             ', data.sandbox);
  console.log('init_point:          ', initUrl);
  console.log('sandbox_init_point:  ', sandboxUrl || '(no devuelto)');

  if (!sandboxUrl) {
    console.error('\n⚠️  sandbox_init_point ausente — TEST_MODE puede no estar activo en Railway');
    console.error('Verifica que Railway tenga: TEST_MODE=true');
    process.exit(1);
  }

  console.log('\n✅ sandbox_init_point recibido correctamente\n');
  console.log('═══════════════════════════════════════════════');
  console.log('  INSTRUCCIONES PARA PRUEBA FINAL');
  console.log('═══════════════════════════════════════════════');
  console.log('1. Abre en incógnito:');
  console.log('  ', sandboxUrl);
  console.log('2. Clic en "Ingresar con mi cuenta"');
  console.log('3. Email:   ', BUYER_EMAIL);
  console.log('4. Password:', BUYER_PASS);
  console.log('5. Selecciona la tarjeta disponible y paga');
  console.log('6. Debe redirigir a:', `${SITE}/gracias.html`);
  console.log('');
  console.log('Tarjeta de prueba alternativa:');
  console.log('  Número: 4013 5406 8274 6260');
  console.log('  Vencimiento: 11/25  CVV: 123  Nombre: APRO');
}

main();
