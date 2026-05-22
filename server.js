require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const sheets = require('./sheets');
const { handleMessage } = require('./whatsapp/bot');
const { sendDailySummary } = require('./whatsapp/sender');

const app = express();
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
const noCache = { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate') };
app.use('/js',  express.static(path.join(__dirname, 'public', 'js'),  noCache));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), noCache));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'products.json');


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

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

app.get('/api/products', async (req, res) => {
  const data = readData();
  try {
    const sheetPrices = await withTimeout(sheets.getPricesFromSheet(), 5000);
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

app.get('/api/resenas', async (req, res) => {
  try {
    const data = await withTimeout(sheets.getResenas(), 5000);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Sheets] Error leyendo reseñas:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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

// ─── Pagos Manuales ───────────────────────────────────────────────────────────

app.post('/api/payments/create', async (req, res) => {
  const { items, customer, paymentMethod, totalUsd, totalLocal } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin items' });

  const juegosList  = [...new Set(items.map(i => i.gameName || i.name).filter(Boolean))].join(', ');
  const serversList = [...new Set(items.map(i => i.server).filter(Boolean))].join(', ');
  const cantidadTot = items.reduce((s, i) => s + ((i.millions || 0) * (i.quantity || 1)), 0);
  const totalCalc   = items.reduce((s, i) => s + parseFloat(i.price_usd || 0) * (i.quantity || 1), 0);

  try {
    await sheets.logOrder({
      nombre:        customer?.name        || 'Cliente',
      usuario_juego: customer?.gameUsername || '',
      pais:          customer?.country      || '',
      email:         customer?.email        || '',
      juego:         juegosList,
      servidor:      serversList,
      cantidad:      cantidadTot,
      total_usd:     totalUsd || totalCalc.toFixed(2),
      total_local:   totalLocal || '',
      metodo_pago:   paymentMethod || '',
    });
  } catch (err) {
    console.error('[Order] Error en Sheets:', err.message);
  }

  res.json({ success: true });
});

// Webhook legacy (no-op)
app.post('/api/payments/webhook', (req, res) => res.sendStatus(200));

// ─── Offers (estáticas por ahora, listas para leer de Sheets OFERTAS) ─────────

app.get('/api/offers', (req, res) => {
  res.json({ offers: [] });
});

// ─── WhatsApp Webhook ─────────────────────────────────────────────────────────

app.get('/webhook/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WA] Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook/whatsapp', (req, res) => {
  res.sendStatus(200); // responder inmediatamente a Meta

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    if (value?.statuses) return; // ignorar status (sent, delivered, read)

    const messages = value?.messages;
    if (!messages?.length) return;

    for (const msg of messages) {
      if (msg.type !== 'text') continue;
      const phone   = msg.from;
      const body    = msg.text?.body || '';
      const contact = value?.contacts?.find(c => c.wa_id === phone);
      const name    = contact?.profile?.name || '';
      handleMessage(phone, body, name).catch(err =>
        console.error('[WA] Error en handleMessage:', err.message)
      );
    }
  } catch (err) {
    console.error('[WA] Error procesando webhook:', err.message);
  }
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
// ─── Resumen diario (22:00 hora Colombia) ────────────────────────────────────

function scheduleDailySummary() {
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const next  = new Date(now);
  next.setHours(22, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    sendDailySummary().catch(err => console.error('[Cron] Error resumen diario:', err.message));
    setInterval(() => {
      sendDailySummary().catch(err => console.error('[Cron] Error resumen diario:', err.message));
    }, 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`[Cron] Resumen diario programado en ${Math.round(delay / 60000)} min`);
}

scheduleDailySummary();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎮  Portal Gamers → http://localhost:${PORT}`);
  console.log(`⚙️   Panel Admin  → http://localhost:${PORT}/admin\n`);
});
