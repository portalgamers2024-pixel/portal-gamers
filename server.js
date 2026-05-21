require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const fetch = require('node-fetch');
const sheets = require('./sheets');

const app = express();
app.use(express.json());app.use("/images", express.static(path.join(__dirname, 'public', 'images')));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'products.json');

const TEST_MODE = process.env.TEST_MODE === 'true';
const activeToken = TEST_MODE && process.env.TEST_ACCESS_TOKEN
  ? process.env.TEST_ACCESS_TOKEN
  : process.env.MP_ACCESS_TOKEN;

if (TEST_MODE) console.log('[MP] ⚠️  TEST_MODE activo — usando token de prueba');

const mpClient = new MercadoPagoConfig({ accessToken: activeToken });

let currencyCache = { rates: null, timestamp: 0 };

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ─── Productos ────────────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  const data = readData();
  try {
    const sheetPrices = await sheets.getPricesFromSheet();
    if (sheetPrices) {
      data.games = data.games.map(g => {
        const gameData = sheetPrices[g.id];
        if (!gameData) return g;

        // Construir mapa server_prices usando el nombre de servidor de products.json como clave
        // Soporta match exacto y parcial (ej. "Global" ↔ "Global (Todos los servidores)")
        const serverPrices = {};
        for (const productServer of g.servers) {
          const exact = gameData[productServer];
          if (exact) {
            serverPrices[productServer] = exact;
            continue;
          }
          // Match parcial (case-insensitive)
          const match = Object.entries(gameData).find(([k]) =>
            k !== '_meta' && (
              productServer.toLowerCase().includes(k.toLowerCase()) ||
              k.toLowerCase().includes(productServer.toLowerCase())
            )
          );
          if (match) serverPrices[productServer] = match[1];
        }

        const meta = gameData._meta || {};
        return {
          ...g,
          // Precio mostrado en card = precio mínimo de venta entre todos los servidores
          price_per_million: meta.min_venta || g.price_per_million,
          server_prices: serverPrices,
        };
      });
      data.source = 'sheets';
    }
  } catch (err) {
    console.error('[Sheets] Error leyendo precios, usando JSON local:', err.message);
  }
  // Evitar que navegadores móviles cacheen precios desactualizados
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(data);
});

// Actualizar configuracion de un juego (precio/millon, stock, etc.)
app.put('/api/admin/games/:gameId', adminAuth, (req, res) => {
  const data = readData();
  const game = data.games.find(g => g.id === req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Juego no encontrado' });

  const { price_per_million, min_millions, max_millions, stock_millions, active } = req.body;
  if (price_per_million !== undefined) game.price_per_million = parseFloat(price_per_million);
  if (min_millions !== undefined) game.min_millions = parseInt(min_millions);
  if (max_millions !== undefined) game.max_millions = parseInt(max_millions);
  if (stock_millions !== undefined) game.stock_millions = parseInt(stock_millions);
  if (active !== undefined) game.active = Boolean(active);

  writeData(data);
  res.json({ success: true, game });
});

// ─── Monedas / Conversión ────────────────────────────────────────────────────

app.get('/api/currency', async (req, res) => {
  const now = Date.now();
  if (currencyCache.rates && (now - currencyCache.timestamp) < 3600000) {
    return res.json({ rates: currencyCache.rates, cached: true });
  }
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await r.json();
    currencyCache = { rates: data.rates, timestamp: now };
    res.json({ rates: data.rates });
  } catch (err) {
    res.json({ rates: currencyCache.rates || {}, error: 'Cache usada' });
  }
});

// ─── Pagos MercadoPago ────────────────────────────────────────────────────────

app.post('/api/payments/create', async (req, res) => {
  const { items, payer } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin items' });

  // Obtener tasa COP/USD (cache del endpoint /api/currency, fallback conservador)
  let copRate = currencyCache.rates?.COP;
  if (!copRate) {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      currencyCache = { rates: d.rates, timestamp: Date.now() };
      copRate = d.rates.COP;
    } catch { copRate = 4200; }
  }

  // Detectar modo sandbox: TEST_MODE activo o token empieza con TEST-
  const isSandbox = TEST_MODE || (activeToken || '').startsWith('TEST-');
  if (isSandbox) console.log('[MP] X-Test-Mode: true — se usará sandbox_init_point');

  try {
    const preference = new Preference(mpClient);
    const isLocalhost = process.env.SITE_URL?.includes('localhost');
    const externalRef = `orden-${Date.now()}`;

    const prefBody = {
      items: items.map(item => ({
        id: item.productId,
        title: item.name,
        description: `Servidor: ${item.server}`,
        quantity: Number(item.quantity),
        // MP Colombia requiere COP — convertimos desde USD
        unit_price: Math.round(parseFloat(item.price_usd) * copRate),
        currency_id: 'COP'
      })),
      payer: (payer && payer.email) ? payer : { email: 'comprador@portalgamerslatam.com' },
      statement_descriptor: 'PORTAL GAMERS',
      external_reference: externalRef,
      metadata: { items },
      // back_urls y notification_url solo con URLs públicas HTTPS
      ...(!isLocalhost ? {
        back_urls: {
          success: `${process.env.SITE_URL}/gracias.html`,
          failure: `${process.env.SITE_URL}/?error=pago`,
          pending: `${process.env.SITE_URL}/gracias.html`
        },
        auto_return: 'approved',
        notification_url: `${process.env.SITE_URL}/api/payments/webhook`,
      } : {}),
    };

    console.log('[MP] Creando preferencia:', JSON.stringify(prefBody, null, 2));
    const result = await preference.create({ body: prefBody });
    console.log('[MP] Respuesta:', JSON.stringify({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    }, null, 2));

    const initPoint = isSandbox
      ? (result.sandbox_init_point || result.init_point)
      : result.init_point;

    res.json({
      init_point: initPoint,
      sandbox_init_point: result.sandbox_init_point || null,
      preference_id: result.id,
      external_reference: externalRef,
      sandbox: isSandbox,
    });
  } catch (err) {
    const detail = err.cause ?? err.error_response ?? err.message;
    console.error('[MP Error]', JSON.stringify(detail, null, 2));
    res.status(500).json({ error: 'Error al crear preferencia de pago', detail });
  }
});

// Webhook MercadoPago (notificaciones de pago)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { type, data } = body;
  console.log('[Webhook MP]', type, data?.id);

  if (type === 'payment' && data?.id) {
    try {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const pago = await r.json();
      if (pago.status === 'approved' && pago.metadata?.items) {
        for (const item of pago.metadata.items) {
          const millions  = item.quantity || 1;
          const precioM   = item.price_usd ? (item.price_usd / millions) : 0;
          await sheets.logSale({
            juego:     item.name,
            servidor:  item.server || '',
            cantidad:  millions,
            moneda:    item.currencyName || '',
            precio_m:  precioM,
            total_usd: item.price_usd || pago.transaction_amount,
            canal:     'MercadoPago',
            asesor:    'Sistema',
            pago_id:   pago.id,
          });
        }
      }
    } catch (err) {
      console.error('[Webhook] Error registrando venta en Sheets:', err.message);
    }
  }
  res.sendStatus(200);
});

// Registro manual de venta (ventas por WhatsApp o fuera de MercadoPago)
app.post('/api/sales/register', adminAuth, async (req, res) => {
  const { juego, servidor, cantidad, moneda, precio_m, total_usd, canal, asesor } = req.body;
  if (!juego || !cantidad) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    await sheets.logSale({ juego, servidor, cantidad, moneda, precio_m, total_usd, canal: canal || 'Manual', asesor: asesor || 'Admin' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Sales] Error:', err.message);
    res.status(500).json({ error: 'No se pudo registrar en Sheets' });
  }
});

// ─── Admin login ──────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: process.env.ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// ─── Páginas SPA ──────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/gracias.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gracias.html')));

app.get("/dofus-kamas.html", (req, res) => res.sendFile(path.join(__dirname, 'public', 'dofus-kamas.html')));
app.get("/albion-silver.html", (req, res) => res.sendFile(path.join(__dirname, 'public', 'albion-silver.html')));
app.get("/wow-gold.html", (req, res) => res.sendFile(path.join(__dirname, 'public', 'wow-gold.html')));
app.get("/vender.html", (req, res) => res.sendFile(path.join(__dirname, 'public', 'vender.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎮  Portal Gamers → http://localhost:${PORT}`);
  console.log(`⚙️   Panel Admin  → http://localhost:${PORT}/admin\n`);
});
