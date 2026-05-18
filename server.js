require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

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

app.get('/api/products', (req, res) => {
  const data = readData();
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

  try {
    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: items.map(item => ({
          id: item.productId,
          title: item.name,
          description: `Servidor: ${item.server}`,
          quantity: Number(item.quantity),
          unit_price: parseFloat(item.price_usd),
          currency_id: 'USD'
        })),
        payer: payer || {},
        back_urls: {
          success: `${process.env.SITE_URL}/gracias.html`,
          failure: `${process.env.SITE_URL}/?error=pago`,
          pending: `${process.env.SITE_URL}/?status=pendiente`
        },
        auto_return: 'approved',
        statement_descriptor: 'PORTAL GAMERS',
        metadata: { items }
      }
    });
    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (err) {
    console.error('[MP Error]', err.message);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
});

// Webhook MercadoPago (notificaciones de pago)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const { type, data } = req.body;
  console.log('[Webhook MP]', type, data);
  // Aquí puedes procesar el pago confirmado y reducir stock automáticamente
  res.sendStatus(200);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎮  Portal Gamers → http://localhost:${PORT}`);
  console.log(`⚙️   Panel Admin  → http://localhost:${PORT}/admin\n`);
});
