require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.MP_ACCESS_TOKEN;
if (!TOKEN) { console.error('ERROR: MP_ACCESS_TOKEN no encontrado en .env'); process.exit(1); }

// MP acepta dos endpoints según versión de cuenta; intentamos ambos
async function createTestUser(label) {
  // Endpoint actual para test users
  const endpoints = [
    'https://api.mercadopago.com/users/test_user',
    'https://api.mercadopago.com/users/test',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ site_id: 'MCO' }),
      });
      const data = await res.json();

      if (data.id) {
        console.log(`[${label}] Creado via ${url}`);
        return data;
      }

      console.warn(`[${label}] ${url} → ${res.status}: ${JSON.stringify(data)}`);
    } catch (err) {
      console.warn(`[${label}] ${url} → Error: ${err.message}`);
    }
  }
  throw new Error(`No se pudo crear usuario ${label} — revisar permisos del token`);
}

async function main() {
  console.log(`Token tipo: ${TOKEN.startsWith('TEST-') ? 'SANDBOX' : 'PRODUCCIÓN'}`);
  console.log('Creando usuario VENDEDOR de prueba...');
  const seller = await createTestUser('SELLER');
  console.log('SELLER:', JSON.stringify(seller, null, 2));

  console.log('\nCreando usuario COMPRADOR de prueba...');
  const buyer = await createTestUser('BUYER');
  console.log('BUYER:', JSON.stringify(buyer, null, 2));

  const output = {
    seller: {
      id: seller.id,
      nickname: seller.nickname,
      email: seller.email,
      password: seller.password,
      access_token: seller.access_token,
      public_key: seller.public_key,
    },
    buyer: {
      id: buyer.id,
      nickname: buyer.nickname,
      email: buyer.email,
      password: buyer.password,
      access_token: buyer.access_token,
      public_key: buyer.public_key,
    },
  };

  const outPath = path.join(__dirname, 'test-users.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nGuardado en: ${outPath}`);
  console.log('\n─── COPIA ESTAS VARIABLES AL .env ───');
  console.log(`TEST_ACCESS_TOKEN=${output.seller.access_token}`);
  console.log(`TEST_PUBLIC_KEY=${output.seller.public_key}`);
  console.log(`TEST_BUYER_EMAIL=${output.buyer.email}`);
  console.log(`TEST_BUYER_PASSWORD=${output.buyer.password}`);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
