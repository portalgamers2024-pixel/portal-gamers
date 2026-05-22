/* ═══════════════════════════════════════════════════════
   Portal Gamers LATAM — Main Frontend Logic
   ═══════════════════════════════════════════════════════ */

let allGames = [];
let currentGame = null;
let currentServer = '';
let currentStep = 'servers'; // 'servers' | 'purchase'
let cart = JSON.parse(localStorage.getItem('pg_cart') || '[]');
let rates = {};
let selectedCurrency = localStorage.getItem('pg_currency') || 'USD';

// ─── Region / Currency selector ────────────────────────────
const REGIONS = {
  CO: { name: 'Colombia',   flag: '🇨🇴', currency: 'COP' },
  MX: { name: 'México',     flag: '🇲🇽', currency: 'MXN' },
  VE: { name: 'Venezuela',  flag: '🇻🇪', currency: 'VES' },
  AR: { name: 'Argentina',  flag: '🇦🇷', currency: 'ARS' },
  CL: { name: 'Chile',      flag: '🇨🇱', currency: 'CLP' },
  PE: { name: 'Perú',       flag: '🇵🇪', currency: 'PEN' },
  BR: { name: 'Brasil',     flag: '🇧🇷', currency: 'BRL' },
  UY: { name: 'Uruguay',    flag: '🇺🇾', currency: 'USD' },
};

const CURRENCY_NAMES = {
  COP:'Peso Colombiano', MXN:'Peso Mexicano', VES:'Bolívar Venezolano',
  ARS:'Peso Argentino',  CLP:'Peso Chileno',  PEN:'Sol Peruano',
  BRL:'Real Brasileño',  USD:'Dólar USD',     UYU:'Peso Uruguayo',
};

function updateRegionButton(code) {
  const region = REGIONS[code];
  const flag = region?.flag || '🌎';
  const currency = region?.currency || (localStorage.getItem('pg_currency') || 'USD');
  const flagEl   = document.getElementById('region-flag');
  const currEl   = document.getElementById('region-currency');
  if (flagEl) flagEl.textContent = flag;
  if (currEl) currEl.textContent = currency;
}

function openRegionModal() {
  const saved = localStorage.getItem('pg_region') || window._geoCountry || 'CO';
  const sel = document.getElementById('modal-region');
  if (sel) sel.value = REGIONS[saved] ? saved : 'CO';
  onRegionChange();
  document.getElementById('region-modal')?.classList.add('open');
}

function closeRegionModal() {
  document.getElementById('region-modal')?.classList.remove('open');
}

function onRegionChange() {
  const code = document.getElementById('modal-region')?.value;
  const region = REGIONS[code];
  const el = document.getElementById('modal-currency-display');
  if (el && region) {
    el.textContent = `${region.currency} — ${CURRENCY_NAMES[region.currency] || region.currency}`;
  }
}

function saveRegion() {
  const code = document.getElementById('modal-region')?.value;
  const region = REGIONS[code];
  if (!region) return;

  localStorage.setItem('pg_region', code);
  localStorage.setItem('pg_currency', region.currency);
  selectedCurrency = region.currency;

  updateRegionButton(code);

  if (currentStep === 'purchase') updateLivePrice();
  else if (currentGame) renderServerCards();
  updateCartUI();

  closeRegionModal();
  showToast(`${region.flag} ${region.name} · ${region.currency}`, 'success');
}

const WA_NUMBER = '573223427456';
const SYMBOLS = {
  USD:'$', COP:'$', ARS:'$', MXN:'$', BRL:'R$',
  PEN:'S/', CLP:'$', EUR:'€', VES:'Bs.', UYU:'$'
};

document.addEventListener('DOMContentLoaded', async () => {
  // Init region button from saved preference
  const savedRegion = localStorage.getItem('pg_region');
  if (savedRegion && REGIONS[savedRegion]) {
    updateRegionButton(savedRegion);
    if (!localStorage.getItem('pg_currency')) {
      selectedCurrency = REGIONS[savedRegion].currency;
      localStorage.setItem('pg_currency', selectedCurrency);
    }
  }

  await Promise.all([loadCurrency(), loadProducts()]);
  updateCartUI();
  initSpotlightStatic();
});

// ─── Info por juego (Tarea 2) ─────────────────────────────
const GAME_INFO = {
  'dofus-retro': [
    '📦 Entrega inmediata en servidor seleccionado',
    '⚡ Tiempo: 5 minutos o menos',
    '🛡️ 100% seguro — miles de entregas realizadas',
    '💡 Mínimo de compra: 1M Kamas',
    '🔄 También compramos tus Kamas',
  ],
  'dofus-3': [
    '📦 Entrega inmediata en servidor seleccionado',
    '⚡ Tiempo: 5 minutos o menos',
    '🛡️ 100% seguro — miles de entregas realizadas',
    '💡 Mínimo de compra: 1M Kamas',
    '🔄 También compramos tus Kamas',
  ],
  'dofus-touch': [
    '📦 Entrega inmediata en servidor seleccionado',
    '⚡ Tiempo: 5 minutos o menos',
    '🛡️ 100% seguro',
    '💡 Mínimo de compra: según servidor',
    '💰 Desde $6.800 COP el millón',
  ],
  'albion': [
    '📦 Entrega inmediata en servidor seleccionado',
    '⚡ Tiempo: 5-10 minutos',
    '🛡️ 100% seguro',
    '💡 Silver entregado en ciudad principal',
    '🔄 También compramos tu Silver',
  ],
  'wakfu': [
    '📦 Entrega inmediata',
    '⚡ Tiempo: 5 minutos o menos',
    '🛡️ 100% seguro',
    '💡 Mínimo de compra: 1M Kamas',
  ],
  'wow-retail': [
    '📦 Entrega en buzón del juego',
    '⚡ Tiempo: 5-30 minutos',
    '🛡️ 100% seguro',
    '💡 Mínimo de compra: 100k Gold (0.1M)',
    '💰 Precio por 100k según servidor y región',
  ],
};

function renderGameInfoPanel(gameId) {
  const panel = document.getElementById('game-info-panel');
  if (!panel) return;
  const lines = GAME_INFO[gameId];
  if (!lines) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="gi-title">Información</div>
    <ul class="gi-list">${lines.map(l => `<li>${l}</li>`).join('')}</ul>
  `;
}

// ─── Productos ────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch('/api/products?_=' + Date.now());
    const data = await res.json();
    allGames = (data.games || []).filter(g => g.active !== false);
    if (allGames.length) {
      renderGameTabs();
      renderNavIcons();
      setGame(allGames[0].id);
    }
  } catch {
    const grid = document.getElementById('products-grid');
    if (grid) grid.innerHTML = '<p style="color:#ef4444;text-align:center;padding:40px;grid-column:1/-1">Error cargando productos. Verifica que el servidor este activo.</p>';
  }
}

function renderNavIcons() {
  const container = document.getElementById('nav-game-icons');
  if (!container) return;
  container.innerHTML = allGames.map(g => `
    <img src="${g.icon_img}" alt="${g.name}"
         class="nav-game-icon" data-game="${g.id}"
         title="${g.name}"
         onclick="setGame('${g.id}')"
         onerror="this.style.display='none'">
  `).join('');
}

function renderGameTabs() {
  const container = document.getElementById('game-tabs');
  if (!container) return;
  container.innerHTML = allGames.map(g => `
    <button class="game-tab" data-game="${g.id}" onclick="setGame('${g.id}')">
      <img src="${g.icon_img}" alt="${g.name}" style="width:40px;height:40px;object-fit:contain" onerror="this.style.display='none'">
      ${g.name}
      ${g.badge ? `<span class="game-tab-badge">${g.badge}</span>` : ''}
    </button>
  `).join('');
}

function setGame(gameId) {
  currentGame = allGames.find(g => g.id === gameId);
  if (!currentGame) return;
  currentServer = '';
  currentStep = 'servers';

  document.querySelectorAll('.game-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.game === gameId));
  document.querySelectorAll('.nav-game-icon').forEach(i =>
    i.classList.toggle('active', i.dataset.game === gameId));

  const tiendaEl = document.getElementById('tienda');
  if (tiendaEl) tiendaEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderGameInfoPanel(gameId);
  renderServerCards();
}

// ─── Step 1: Server Cards ──────────────────────────────────
function renderServerCards() {
  if (!currentGame) return;
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  currentStep = 'servers';
  const g = currentGame;

  const unitLabel = g.unit_label || `M ${g.currency_name}`;
  const isWow = !!g.unit_label;
  grid.innerHTML = g.servers.map(server => {
    const serverPrice = g.server_prices?.[server]?.venta ?? g.price_per_million;
    const localRate   = isWow ? getWowLocalPrice(g, server) : convertPrice(serverPrice);
    const priceDisplay = isWow
      ? `$${serverPrice.toFixed(2)}<span class="sc-unit"> / ${unitLabel}</span>`
      : `$${serverPrice.toFixed(2)}<span class="sc-unit"> / M ${g.currency_name}</span>`;
    const localDisplay = isWow
      ? (localRate ? `<div class="sc-local">${localRate} / ${unitLabel}</div>` : '')
      : (localRate ? `<div class="sc-local">&#8776; ${localRate} / M</div>` : '');
    return `
      <div class="server-card" data-game-id="${g.id}" onclick="selectServer('${server.replace(/'/g, "\\'")}')">
        <img class="sc-icon" src="${g.icon_img}" alt="${g.name}" onerror="this.style.display='none'">
        <div class="sc-game-badge">${g.name}</div>
        <div class="sc-name">${server}</div>
        <div class="sc-price">${priceDisplay}</div>
        ${localDisplay}
        <div class="sc-delivery">&#9889; ${g.delivery}</div>
        <div class="sc-select-btn">Seleccionar &rarr;</div>
      </div>`;
  }).join('');

  initSpotlightCards();
}

// ─── Step 2: Purchase Form ──────────────────────────────────
function selectServer(serverName) {
  if (!currentGame) return;
  currentServer = serverName;
  // Usar el precio específico del servidor si viene de Sheets
  const serverData = currentGame.server_prices?.[serverName];
  if (serverData?.venta) {
    currentGame.price_per_million = serverData.venta;
  }
  currentStep = 'purchase';
  renderPurchaseForm();
}

function renderPurchaseForm() {
  if (!currentGame || !currentServer) return;
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const g = currentGame;
  const isWow = !!g.unit_label;
  const unitLabel = g.unit_label || `M ${g.currency_name}`;
  const defaultM = g.min_millions || 1;
  const presets = getPresets(g.min_millions, g.max_millions);
  const initTotal = (defaultM * g.price_per_million).toFixed(2);
  const initLocal = isWow
    ? (getWowLocalPrice(g, currentServer) || '')
    : (convertPrice(defaultM * g.price_per_million) || '');
  const rateLocal = isWow
    ? getWowLocalPrice(g, currentServer)
    : convertPrice(g.price_per_million);
  const qtyLabel = isWow
    ? `Cantidad de unidades (1 unidad = ${unitLabel})`
    : `Cantidad de ${g.currency_name} (en Millones)`;
  const presetLabel = isWow ? '' : 'M';
  const wowNote = isWow
    ? `<div class="pf-wow-note">&#128279; Precio de referencia: <a href="${g.price_reference || 'https://undermine.exchange'}" target="_blank" rel="noopener">undermine.exchange</a></div>`
    : '';

  grid.innerHTML = `
    <div class="purchase-form" style="grid-column:1/-1">
      <div class="pf-nav">
        <button class="pf-back-btn" onclick="goBack()">&#8592; Cambiar servidor</button>
        <span class="pf-breadcrumb">${g.name} &rsaquo; ${currentServer}</span>
      </div>

      <div class="pf-header">
        <img class="pf-icon" src="${g.icon_img}" alt="${g.name}" onerror="this.style.display='none'" style="${isWow ? 'border-radius:8px;object-fit:cover' : ''}">
        <div class="pf-game-info">
          <div class="pf-game-name">${g.name}</div>
          <div class="pf-server">&#127758; ${currentServer}</div>
          ${g.note ? `<div class="pf-note">${g.note}</div>` : ''}
        </div>
        <div class="pf-rate-box">
          <div class="pf-rate-label">Precio por ${unitLabel}</div>
          <div class="pf-rate">$${g.price_per_million.toFixed(2)}<span> USD</span></div>
          ${rateLocal ? `<div class="pf-rate-local">&#8776; ${rateLocal}</div>` : ''}
        </div>
      </div>

      <div class="pf-body">
        <div class="pf-section-label">${qtyLabel}</div>
        <div class="pf-presets">
          ${presets.map(p => `<button class="pf-preset" onclick="setMillions(${p})">${p}${presetLabel}</button>`).join('')}
        </div>
        <div class="pf-qty-row">
          <button class="pf-adj" onclick="adjustMillions(-10)">&#8722;10</button>
          <button class="pf-adj" onclick="adjustMillions(-1)">&#8722;1</button>
          <input type="number" id="millions-input" class="pf-input"
                 value="${defaultM}" min="1" max="${g.max_millions}" step="1"
                 oninput="updateLivePrice()">
          <button class="pf-adj" onclick="adjustMillions(+1)">+1</button>
          <button class="pf-adj" onclick="adjustMillions(+10)">+10</button>
        </div>

        <div class="pf-total-box">
          <div class="pf-total-row">
            <span class="pf-total-label">Total a pagar:</span>
            <span class="pf-total-usd" id="live-total">$${initTotal} USD</span>
          </div>
          <div class="pf-total-local" id="live-local">${initLocal}</div>
          <div class="pf-stock-info">&#128230; Stock disponible: ~${g.stock_millions.toLocaleString()} ${isWow ? 'unidades' : `M ${g.currency_name}`}</div>
          ${wowNote}
        </div>

        <div class="pf-actions">
          <button class="pf-btn-buy" onclick="buyNow()">🛒 Comprar ahora</button>
          <div class="pf-actions-secondary">
            <button class="pf-btn-cart" onclick="addCustomToCart()">+ Agregar al carrito</button>
            <button class="pf-btn-wa" onclick="orderViaWhatsApp()">&#128172; Pedir por WhatsApp</button>
          </div>
        </div>
      </div>
    </div>`;
}

function getPresets(min, max) {
  return [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000].filter(p => p >= min && p <= max).slice(0, 6);
}

function goBack() {
  currentStep = 'servers';
  currentServer = '';
  renderServerCards();
}

function adjustMillions(delta) {
  const input = document.getElementById('millions-input');
  if (!input || !currentGame) return;
  const cur = parseInt(input.value) || currentGame.min_millions;
  input.value = Math.max(currentGame.min_millions, Math.min(currentGame.max_millions, cur + delta));
  updateLivePrice();
}

function setMillions(val) {
  const input = document.getElementById('millions-input');
  if (!input) return;
  input.value = val;
  updateLivePrice();
}

function updateLivePrice() {
  const input = document.getElementById('millions-input');
  if (!input || !currentGame) return;
  let millions = parseInt(input.value) || currentGame.min_millions;
  millions = Math.max(currentGame.min_millions, Math.min(currentGame.max_millions, millions));
  if (parseInt(input.value) !== millions) input.value = millions;
  const total = millions * currentGame.price_per_million;
  const totalEl = document.getElementById('live-total');
  const localEl = document.getElementById('live-local');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)} USD`;
  if (localEl) {
    const isWow = !!currentGame.unit_label;
    let lp;
    if (isWow && currentGame.local_prices?.sell) {
      const lps = currentGame.local_prices.sell;
      const rate = lps[selectedCurrency];
      if (rate) {
        const sym = selectedCurrency === 'VES' ? 'Bs.' : '$';
        lp = `${sym}${(rate * millions).toLocaleString('es-CO')} ${selectedCurrency}`;
      }
    } else {
      lp = convertPrice(total);
    }
    localEl.textContent = lp || '';
  }
}

function addCustomToCart() {
  if (!currentGame) return;
  const input = document.getElementById('millions-input');
  if (!input) return;
  let millions = parseInt(input.value) || currentGame.min_millions;
  millions = Math.max(currentGame.min_millions, Math.min(currentGame.max_millions, millions));

  if (millions > currentGame.stock_millions) {
    showToast('Stock insuficiente para esa cantidad', 'error');
    return;
  }

  const g = currentGame;
  const priceUsd = parseFloat((millions * g.price_per_million).toFixed(2));
  const cartKey = `${g.id}__${currentServer}__${millions}`;
  const existing = cart.find(c => c.cartKey === cartKey);

  if (existing) {
    showToast('Ese pedido ya esta en el carrito', 'success');
    openCart();
    return;
  }

  const unitLabel = g.unit_label || `M ${g.currency_name}`;
  cart.push({
    cartKey,
    gameId: g.id,
    server: currentServer,
    millions,
    currencyName: g.currency_name,
    unitLabel,
    name: `${millions} ${unitLabel}`,
    gameName: g.name,
    gameIcon: g.icon,
    iconImg: g.icon_img,
    serverLabel: currentServer,
    price_usd: priceUsd,
    price_per_million: g.price_per_million,
    quantity: 1,
    stock: g.stock_millions,
    delivery: g.delivery
  });

  showToast(`${millions} ${unitLabel} agregado al carrito!`, 'success');
  saveCart();
  updateCartUI();
  openCart();
}

function buyNow() {
  if (!currentGame) return;
  const input = document.getElementById('millions-input');
  if (!input) return;
  let millions = parseInt(input.value) || currentGame.min_millions;
  millions = Math.max(currentGame.min_millions, Math.min(currentGame.max_millions, millions));

  if (millions > currentGame.stock_millions) {
    showToast('Stock insuficiente para esa cantidad', 'error');
    return;
  }

  const g = currentGame;
  const priceUsd = parseFloat((millions * g.price_per_million).toFixed(2));
  const cartKey = `${g.id}__${currentServer}__${millions}`;

  if (!cart.find(c => c.cartKey === cartKey)) {
    cart.push({
      cartKey,
      gameId: g.id,
      server: currentServer,
      millions,
      currencyName: g.currency_name,
      unitLabel: g.unit_label || `M ${g.currency_name}`,
      name: `${millions} ${g.unit_label || `M ${g.currency_name}`}`,
      gameName: g.name,
      gameIcon: g.icon,
      iconImg: g.icon_img,
      serverLabel: currentServer,
      price_usd: priceUsd,
      price_per_million: g.price_per_million,
      quantity: 1,
      stock: g.stock_millions,
      delivery: g.delivery
    });
    saveCart();
    updateCartUI();
  }

  openCheckout();
}

function orderViaWhatsApp() {
  if (!currentGame) return;
  const input = document.getElementById('millions-input');
  if (!input) return;
  let millions = parseInt(input.value) || currentGame.min_millions;
  millions = Math.max(currentGame.min_millions, Math.min(currentGame.max_millions, millions));
  const g = currentGame;
  const total = (millions * g.price_per_million).toFixed(2);
  const msg = encodeURIComponent(
    `Hola Portal Gamers! Quiero hacer un pedido:\n\n` +
    `${g.icon} ${millions}M ${g.currency_name} - ${g.name}\n` +
    `Servidor: ${currentServer}\n` +
    `Total: $${total} USD\n\n` +
    `Pueden confirmar disponibilidad y metodo de pago?`
  );
  window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
}

// ─── Cart ─────────────────────────────────────────────────
function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) { removeFromCart(index); return; }
  item.quantity = newQty;
  saveCart();
  updateCartUI();
}

function saveCart() { localStorage.setItem('pg_cart', JSON.stringify(cart)); }
function cartTotal() { return cart.reduce((s, i) => s + i.price_usd * i.quantity, 0); }

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }

  const itemsEl = document.getElementById('cart-items');
  const footerEl = document.getElementById('cart-footer');
  if (!itemsEl) return;

  if (!cart.length) {
    itemsEl.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">&#128722;</div><p>Tu carrito esta vacio</p></div>`;
    if (footerEl) footerEl.style.display = 'none';
    return;
  }

  itemsEl.innerHTML = cart.map((item, i) => {
    const totalItem = item.price_usd * item.quantity;
    const millionsTotal = (item.millions || 0) * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.gameIcon || ''} ${item.gameName}</div>
          <div class="cart-item-sub">${item.name} &middot; ${item.serverLabel} &middot; &#9889; ${item.delivery}</div>
          <div class="cart-item-price">
            $${totalItem.toFixed(2)} USD
            ${item.quantity > 1 && millionsTotal ? `<span style="font-size:11px;color:var(--text-m)">&nbsp;(${millionsTotal}M total)</span>` : ''}
          </div>
          <div class="cart-qty">
            <button class="qty-btn" onclick="changeQty(${i},-1)">&#8722;</button>
            <span class="qty-num">${item.quantity}</span>
            <button class="qty-btn" onclick="changeQty(${i},+1)">+</button>
          </div>
        </div>
        <button class="btn-remove" onclick="removeFromCart(${i})">&#10005;</button>
      </div>`;
  }).join('');

  const total = cartTotal();
  const totalEl = document.getElementById('cart-total-usd');
  const localEl = document.getElementById('cart-total-local');
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)} USD`;
  if (localEl) { const lp = convertPrice(total); localEl.textContent = lp ? `aprox. ${lp}` : ''; }
  if (footerEl) footerEl.style.display = 'block';
}

function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  updateCartUI();
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
}

// ─── Checkout ─────────────────────────────────────────────
const PAYMENT_METHODS = {
  Colombia: [
    {
      icon: '📱',
      name: 'Nequi / Daviplata',
      fields: [
        { label: 'Número', value: '3016008994' }
      ]
    },
    {
      icon: '🔑',
      name: 'Llave Colombia',
      fields: [
        { label: 'Número', value: '3016008994' }
      ]
    }
  ],
  Venezuela: [
    {
      icon: '📱',
      name: 'Pago Móvil',
      fields: [
        { label: 'Número', value: '04126275407' },
        { label: 'Cédula', value: '23642839' }
      ]
    }
  ],
  Chile: [
    {
      icon: '🏦',
      name: 'Cuenta RUT Banco Estado',
      fields: [
        { label: 'RUT', value: '17342378-0' }
      ]
    }
  ],
  Mexico: [
    {
      icon: '🏦',
      name: 'Santander',
      fields: [
        { label: 'Número tarjeta', value: '5579 0900 4324 8252' }
      ]
    }
  ],
  Otro: [
    {
      icon: '🏦',
      name: 'Banco Unión Colombia',
      fields: [
        { label: 'Cuenta Ahorros', value: '01735600000529916' },
        { label: 'A nombre de', value: 'Leandro Jose Acosta Garcia', copyable: false },
        { label: 'Cédula', value: '1082985969' }
      ]
    },
    {
      icon: '₿',
      name: 'Binance',
      fields: [
        { label: 'Email', value: 'andressuperlano@gmail.com' },
        { label: 'Email 2', value: 'leandro.acosta940614@outlook.com' }
      ]
    },
    {
      icon: '💳',
      name: 'Skrill',
      fields: [
        { label: 'Email', value: 'leandro.acosta940614@outlook.com' }
      ]
    },
    {
      icon: '💸',
      name: 'Remitly',
      fields: [
        { label: 'Nombre', value: 'Leandro Jose Acosta Garcia', copyable: false },
        { label: 'Cta. Bancolombia', value: '77903852944' },
        { label: 'Celular', value: '3016008994' }
      ]
    }
  ]
};

let checkoutOrderData = {};
let selectedPaymentMethod = '';

function openCheckout() {
  if (!cart.length) return;
  const total = cartTotal();
  const local = convertPrice(total);
  const summaryEl = document.getElementById('checkout-summary');
  if (summaryEl) {
    summaryEl.textContent = `Total: $${total.toFixed(2)} USD${local ? ` (aprox. ${local})` : ''} · ${cart.length} producto(s)`;
  }
  showCheckoutStep(1);
  document.getElementById('checkout-modal')?.classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkout-modal')?.classList.remove('open');
}

function showCheckoutStep(step) {
  [1, 2, 3].forEach(n => {
    const el  = document.getElementById(`checkout-step-${n}`);
    const ind = document.getElementById(`csi-${n}`);
    if (el)  el.style.display = n === step ? 'block' : 'none';
    if (ind) {
      ind.classList.toggle('active', n === step);
      ind.classList.toggle('done',   n < step);
    }
  });
}

function nextToPayment() {
  const name     = document.getElementById('cf-name')?.value?.trim();
  const username = document.getElementById('cf-username')?.value?.trim();
  const country  = document.getElementById('cf-country')?.value;

  if (!username) { showToast('Por favor ingresa tu usuario en el juego', 'error'); return; }
  if (!country)  { showToast('Por favor selecciona tu país', 'error'); return; }

  checkoutOrderData = { name, username, country };

  const methods = PAYMENT_METHODS[country] || PAYMENT_METHODS['Otro'];
  selectedPaymentMethod = methods.length > 0 ? methods[0].name : '';

  const container = document.getElementById('payment-methods-container');
  if (container) container.innerHTML = getPaymentMethodsHTML(country);

  showCheckoutStep(2);
}

function backToForm() { showCheckoutStep(1); }

function getPaymentMethodsHTML(country) {
  const methods = PAYMENT_METHODS[country] || PAYMENT_METHODS['Otro'];
  return methods.map((method, mi) => `
    <div class="pm-card${mi === 0 ? ' selected' : ''}"
         onclick="selectPaymentCard(this, '${method.name.replace(/'/g, '&#39;')}')"
         data-method-name="${method.name.replace(/"/g, '&quot;')}">
      <div class="pm-card-header">
        <span class="pm-icon">${method.icon}</span>
        <div class="pm-name">${method.name}</div>
      </div>
      <div class="pm-fields">
        ${method.fields.map(f => `
          <div class="pm-data-row">
            <span class="pm-data-label">${f.label}</span>
            <span class="pm-data-value">${f.value}</span>
            ${f.copyable !== false
              ? `<button class="pm-copy-btn" data-copy="${f.value.replace(/"/g, '&quot;')}" onclick="event.stopPropagation();copyFromBtn(this)">&#128203;</button>`
              : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function selectPaymentCard(el, methodName) {
  document.querySelectorAll('.pm-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedPaymentMethod = methodName;
}

function copyFromBtn(btn) {
  const text = btn.getAttribute('data-copy');
  if (!text) return;
  const doFeedback = () => {
    const orig = btn.innerHTML;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doFeedback).catch(() => fallbackCopy(text, doFeedback));
  } else {
    fallbackCopy(text, doFeedback);
  }
}

function fallbackCopy(text, callback) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); if (callback) callback(); } catch (e) {}
  document.body.removeChild(el);
}

function toggleTooltip(icon) {
  const tip = icon.nextElementSibling;
  if (!tip) return;
  const isOpen = tip.classList.contains('visible');
  document.querySelectorAll('.cf-tooltip.visible').forEach(t => t.classList.remove('visible'));
  if (!isOpen) tip.classList.add('visible');
}

document.addEventListener('click', function(e) {
  if (!e.target.classList.contains('cf-info-icon')) {
    document.querySelectorAll('.cf-tooltip.visible').forEach(t => t.classList.remove('visible'));
  }
});

async function confirmOrder() {
  const btn = document.getElementById('btn-confirm-payment');
  if (btn) { btn.textContent = 'Procesando...'; btn.disabled = true; }

  const total     = cartTotal();
  const local     = convertPrice(total);
  const { name, username, country } = checkoutOrderData;
  const payMethod = selectedPaymentMethod || 'No especificado';

  const itemsSummary = cart.map(i => {
    const m = (i.millions || 0) * i.quantity;
    return `${i.gameName} (${i.serverLabel}): ${m}M ${i.currencyName}`;
  }).join(', ');

  const juegosList  = [...new Set(cart.map(i => i.gameName))].join(', ');
  const serversList = [...new Set(cart.map(i => i.serverLabel))].join(', ');

  try {
    await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({
          productId:    i.cartKey || i.gameId,
          gameId:       i.gameId,
          name:         i.name,
          gameName:     i.gameName,
          server:       i.serverLabel,
          price_usd:    i.price_usd,
          quantity:     i.quantity,
          millions:     i.millions,
          currencyName: i.currencyName,
        })),
        customer:      { name, gameUsername: username, country },
        paymentMethod: payMethod,
        totalUsd:      total.toFixed(2),
        totalLocal:    local || '',
      })
    });
  } catch (err) {
    console.warn('[Checkout] Error registrando en Sheets:', err.message);
  }

  const fecha    = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const localLine = local ? `\n💴 *Total local:* ${local}` : '';

  const waMsg = encodeURIComponent(
    `🎮 *NUEVO PEDIDO - Portal Gamers LATAM*\n\n` +
    `👤 *Cliente:* ${name || 'No indicado'}\n` +
    `🎯 *Usuario en juego:* ${username}\n` +
    `🌍 *País:* ${country}\n\n` +
    `🎮 *Pedido:* ${itemsSummary}\n\n` +
    `💵 *Total USD:* $${total.toFixed(2)}` + localLine + `\n\n` +
    `💳 *Método de pago:* ${payMethod}\n\n` +
    `⏰ *Fecha:* ${fecha}\n\n` +
    `✅ Cliente confirmó el pago - Verificar y entregar`
  );

  cart = []; saveCart(); updateCartUI(); closeCart();
  window.open(`https://wa.me/573016008994?text=${waMsg}`, '_blank');

  if (btn) { btn.textContent = '✓ Confirmar pedido'; btn.disabled = false; }
  showCheckoutStep(3);
}

// ─── Currency ─────────────────────────────────────────────
async function loadCurrency() {
  try {
    const res = await fetch('/api/currency');
    const data = await res.json();
    rates = data.rates || {};

    // If no saved region/currency, wait briefly for geo then apply
    if (!localStorage.getItem('pg_region')) {
      await new Promise(r => setTimeout(r, 800)); // let geo.js settle
      if (window._geoCountry && REGIONS[window._geoCountry]) {
        const region = REGIONS[window._geoCountry];
        if (!localStorage.getItem('pg_currency')) {
          selectedCurrency = region.currency;
          localStorage.setItem('pg_currency', region.currency);
        }
        updateRegionButton(window._geoCountry);
      }
    }
  } catch { rates = {}; }
}

function convertPrice(usd) {
  if (selectedCurrency === 'USD' || !rates[selectedCurrency]) return null;
  const converted = usd * rates[selectedCurrency];
  const sym = SYMBOLS[selectedCurrency] || (selectedCurrency + ' ');
  return `${sym}${converted >= 1000 ? Math.round(converted).toLocaleString('es-CO') : converted.toFixed(2)} ${selectedCurrency}`;
}

function getWowLocalPrice(game, server) {
  if (!game?.local_prices?.sell) return null;
  const lp = game.local_prices.sell;
  if (selectedCurrency === 'COP' && lp.COP) return `$${lp.COP.toLocaleString('es-CO')} COP`;
  if (selectedCurrency === 'VES' && lp.VES) return `Bs.${lp.VES.toLocaleString('es-CO')} VES`;
  if (selectedCurrency === 'CLP' && lp.CLP) return `$${lp.CLP.toLocaleString('es-CO')} CLP`;
  if (selectedCurrency === 'MXN' && lp.MXN) return `$${lp.MXN} MXN`;
  return null;
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ─── Spotlight card effect ────────────────────────────────
const SPOTLIGHT_HUE = {
  DOFUS:  30,
  ALBION: 210,
  WAKFU:  130,
  WOW:    280,
  WORLD:  280,
};

function getHueForGame(gameId) {
  if (!gameId) return 30;
  const upper = gameId.toUpperCase();
  for (const [key, hue] of Object.entries(SPOTLIGHT_HUE)) {
    if (upper.includes(key)) return hue;
  }
  return 30;
}

function _isTouchDevice() {
  return window.matchMedia('(max-width: 768px)').matches ||
         window.matchMedia('(hover: none)').matches;
}

function applySpotlight(el, hue) {
  if (hue !== undefined) el.style.setProperty('--sg-hue', hue);
  el.addEventListener('pointermove', function(e) {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--sg-x', (e.clientX - rect.left).toFixed(1));
    el.style.setProperty('--sg-y', (e.clientY - rect.top).toFixed(1));
  }, { passive: true });
  el.addEventListener('pointerleave', function() {
    el.style.setProperty('--sg-x', '-999');
    el.style.setProperty('--sg-y', '-999');
  }, { passive: true });
}

// Called once at DOMContentLoaded for static HTML cards
function initSpotlightStatic() {
  if (_isTouchDevice()) return;
  document.querySelectorAll('.buysell-card, .step-card, .payment-group').forEach(el => {
    applySpotlight(el); // --sg-hue already set in CSS per class
  });
}

// Called after renderServerCards() — dynamic cards only
function initSpotlightCards() {
  if (_isTouchDevice()) return;
  document.querySelectorAll('.server-card').forEach(card => {
    applySpotlight(card, getHueForGame(card.dataset.gameId));
  });
}
