// Geolocalización por IP - Portal Gamers LATAM
const GEO_PAYMENT_METHODS = {
  CO: { name: "Colombia", flag: "🇨🇴", currency: "COP", symbol: "$", methods: ["MercadoPago", "Nequi", "Daviplata", "Bancolombia", "Efecty", "BBVA", "PSE"] },
  MX: { name: "México", flag: "🇲🇽", currency: "MXN", symbol: "$", methods: ["MercadoPago", "OXXO", "SPEI", "Transferencia bancaria"] },
  VE: { name: "Venezuela", flag: "🇻🇪", currency: "USD", symbol: "$", methods: ["Binance Pay", "Tether USDT", "Skrill", "Transferencia internacional"] },
  AR: { name: "Argentina", flag: "🇦🇷", currency: "ARS", symbol: "$", methods: ["MercadoPago", "Transferencia bancaria", "Binance Pay"] },
  BR: { name: "Brasil", flag: "🇧🇷", currency: "BRL", symbol: "R$", methods: ["MercadoPago", "PIX", "Transferencia bancaria"] },
  CL: { name: "Chile", flag: "🇨🇱", currency: "CLP", symbol: "$", methods: ["MercadoPago", "Webpay", "Transferencia bancaria"] },
  PE: { name: "Perú", flag: "🇵🇪", currency: "PEN", symbol: "S/", methods: ["MercadoPago", "Yape", "Plin", "Transferencia bancaria"] },
  UY: { name: "Uruguay", flag: "🇺🇾", currency: "UYU", symbol: "$", methods: ["MercadoPago", "Transferencia bancaria"] },
  DEFAULT: { name: "Internacional", flag: "🌎", currency: "USD", symbol: "$", methods: ["Skrill", "Tether USDT", "Binance Pay", "Western Union"] }
};

async function detectCountry() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return data.country_code || "DEFAULT";
  } catch { return "DEFAULT"; }
}

async function initGeo() {
  const code = await detectCountry();
  window._geoCountry = code;

  // Notify main.js region button if no saved preference
  if (!localStorage.getItem('pg_region') && typeof updateRegionButton === 'function') {
    updateRegionButton(code);
    // Also sync currency if not already set
    if (!localStorage.getItem('pg_currency')) {
      const CURRENCY_MAP = { CO:'COP', MX:'MXN', AR:'ARS', BR:'BRL', CL:'CLP', PE:'PEN', UY:'USD', VE:'VES' };
      const detected = CURRENCY_MAP[code] || 'USD';
      localStorage.setItem('pg_currency', detected);
      if (typeof selectedCurrency !== 'undefined') window.selectedCurrency = detected;
    }
  }
}

function changeCountry(code) {
  const country = GEO_PAYMENT_METHODS[code] || GEO_PAYMENT_METHODS.DEFAULT;
  const paymentSections = document.querySelectorAll(".payment-methods, .metodos-pago, div[class*='payment']");
  paymentSections.forEach(section => {
    const badges = country.methods.map(m =>
      `<span style="background:#0d1f45;border:1px solid #29ABD4;border-radius:8px;padding:8px 14px;font-size:13px;color:#fff;display:inline-block;margin:4px;">${m}</span>`
    ).join("");
    section.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 0;">${badges}</div>`;
  });
}

document.addEventListener("DOMContentLoaded", initGeo);
