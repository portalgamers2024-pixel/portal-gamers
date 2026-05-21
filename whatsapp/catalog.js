'use strict';

const fs     = require('fs');
const path   = require('path');
const sheets = require('../sheets');

// Tasas de cambio estáticas (fallback)
const RATES = {
  Colombia:  { currency: 'COP', rate: 4000, symbol: '$',    name: 'COP' },
  Venezuela: { currency: 'VES', rate: 36,   symbol: 'Bs.S', name: 'VES' },
  Chile:     { currency: 'CLP', rate: 960,  symbol: '$',    name: 'CLP' },
  Mexico:    { currency: 'MXN', rate: 17,   symbol: '$',    name: 'MXN' },
  Otro:      { currency: 'USD', rate: 1,    symbol: '$',    name: 'USD' },
};

const GAME_ICONS = {
  'dofus-retro':  '💛',
  'dofus-3':      '💙',
  'dofus-touch':  '🟠',
  'wakfu':        '🌿',
  'albion':       '⚔️',
};

function getProducts() {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8')
  );
  return (data.games || []).filter(g => g.active !== false);
}

// Cache 5 minutos para precios de Sheets
let priceCache = { data: null, ts: 0 };
const PRICE_TTL = 5 * 60 * 1000;

async function getPrices() {
  const now = Date.now();
  if (priceCache.data && now - priceCache.ts < PRICE_TTL) return priceCache.data;
  try {
    const data = await sheets.getPricesFromSheet();
    if (data) {
      priceCache = { data, ts: now };
      return data;
    }
  } catch (e) {
    console.warn('[catalog] No se pudieron obtener precios de Sheets:', e.message);
  }
  return priceCache.data || null;
}

function getServerPrice(sheetPrices, gameId, serverName, fallback) {
  if (!sheetPrices || !sheetPrices[gameId]) return fallback;
  const gameData = sheetPrices[gameId];
  if (gameData[serverName]) return gameData[serverName].venta;
  // Match parcial
  const match = Object.entries(gameData).find(([k]) =>
    k !== '_meta' && (
      serverName.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(serverName.toLowerCase())
    )
  );
  return match ? match[1].venta : (gameData._meta?.min_venta || fallback);
}

function formatLocal(usd, country) {
  const info = RATES[country] || RATES.Otro;
  if (info.currency === 'USD') return `$${Number(usd).toFixed(2)} USD`;
  const local = Math.round(Number(usd) * info.rate);
  return `${info.symbol}${local.toLocaleString('es-CO')} ${info.currency}`;
}

async function generateCatalog() {
  const games  = getProducts();
  const prices = await getPrices();

  let msg = '🎮 *Catálogo Portal Gamers LATAM*\n━━━━━━━━━━━━━━━━━━━━\n';

  for (const game of games) {
    const icon = GAME_ICONS[game.id] || '🎮';
    msg += `\n${icon} *${game.name.toUpperCase()}*\n`;
    for (const server of game.servers) {
      const price = getServerPrice(prices, game.id, server, game.price_per_million);
      const cop   = Math.round(price * RATES.Colombia.rate);
      msg += `  • ${server}: $${price.toFixed(2)} USD/M (~$${cop.toLocaleString('es-CO')} COP)\n`;
    }
  }

  msg += '\n━━━━━━━━━━━━━━━━━━━━';
  msg += '\n⚡ Entrega en 5 minutos';
  msg += '\n🛡️ 100% Seguro | Lun-Dom 10AM-10PM';
  msg += '\n🌐 portalgamerslatam.com';

  return msg;
}

function getGameMenu() {
  const games = getProducts();
  let msg = '🎮 *¿Qué juego deseas?*\n\n';
  games.forEach((g, i) => {
    const icon = GAME_ICONS[g.id] || '🎮';
    msg += `${i + 1}️⃣ ${icon} ${g.name}\n`;
  });
  msg += '\n_Responde con el número_';
  return { text: msg, games };
}

async function getServerMenu(game) {
  const prices = await getPrices();
  let msg = `🌐 *Servidores de ${game.name}:*\n\n`;
  game.servers.forEach((server, i) => {
    const price = getServerPrice(prices, game.id, server, game.price_per_million);
    msg += `${i + 1}️⃣ ${server} — $${price.toFixed(2)} USD/M\n`;
  });
  msg += '\n_Responde con el número_';
  return { text: msg };
}

async function calculatePrice(game, serverName, quantity, country) {
  const prices     = await getPrices();
  const pricePerM  = getServerPrice(prices, game.id, serverName, game.price_per_million);
  const totalUSD   = pricePerM * Number(quantity);
  const localStr   = formatLocal(totalUSD, country);
  return { pricePerM, totalUSD, localStr };
}

module.exports = {
  getProducts,
  getPrices,
  generateCatalog,
  getGameMenu,
  getServerMenu,
  calculatePrice,
  formatLocal,
};
