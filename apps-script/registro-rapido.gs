/**
 * Portal Gamers LATAM — Scripts de Registro Rápido
 *
 * INSTALACIÓN:
 *   1. Abrir el Google Sheet
 *   2. Ir a Extensiones → Apps Script
 *   3. Borrar el código de ejemplo y pegar TODO este archivo
 *   4. Guardar (Ctrl+S) → Darle un nombre, ej: "PortalGamers"
 *   5. Ejecutar onOpen() una vez para autorizar permisos
 *   6. Crear los botones (ver instrucciones al final)
 *
 * ESTRUCTURA DE FORMULARIOS:
 *   VENTA     → col B (labels) + col C (valores) filas 4-13
 *   COMPRA    → col E (labels) + col F (valores) filas 4-16
 *   INTERCAMBIO → col H (labels) + col I (valores) filas 4-14
 */

// URL del servidor (actualizar con la URL de Railway)
var SERVER_URL = 'https://portal-gamers-production.up.railway.app';

// ─── Menú personalizado ──────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎮 Portal Gamers')
    .addItem('🔴 Registrar Compra',       'registrarCompra')
    .addItem('💚 Registrar Venta',         'registrarVenta')
    .addItem('🔄 Registrar Intercambio',   'registrarIntercambio')
    .addSeparator()
    .addItem('🧹 Limpiar Formulario Compra',  'limpiarCompra')
    .addItem('🧹 Limpiar Formulario Venta',   'limpiarVenta')
    .addToUi();
}

// ─── Utilidad: buscar juego de un servidor ───────────────────────────────────

function getJuegoPorServidor(servidor) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var hoja   = ss.getSheetByName('💰 Precios');
  if (!hoja) return '';
  var datos  = hoja.getRange('A6:B30').getValues();
  var juego  = '';
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0]) juego = datos[i][0];
    if (datos[i][1] === servidor) return juego;
  }
  return '';
}

// ─── REGISTRAR COMPRA ────────────────────────────────────────────────────────

function registrarCompra() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('📋 Compras');

  if (!log) {
    SpreadsheetApp.getUi().alert('❌ No existe la pestaña "📋 Compras". Contacta al administrador.');
    return;
  }

  // Leer valores del formulario
  var asesor           = form.getRange('F4').getValue();
  var servidor         = form.getRange('F5').getValue();
  var cantidad         = form.getRange('F6').getValue();
  var monedaCompra     = form.getRange('F7').getValue();
  var proveedor        = form.getRange('F8').getValue();
  var precioCompraUSD  = form.getRange('F9').getValue();
  var totalUSDPagado   = form.getRange('F10').getValue();
  var valorMonedaLocal = form.getRange('F11').getValue();
  var precioVentaUSD   = form.getRange('F12').getValue();
  var margenUSD        = form.getRange('F13').getValue();
  var gananciaTotal    = form.getRange('F14').getValue();
  var monedaVenta      = form.getRange('F15').getValue();
  var valorVentaLocal  = form.getRange('F16').getValue();

  // Validación campos obligatorios
  if (!servidor || !cantidad || !precioCompraUSD) {
    SpreadsheetApp.getUi().alert('⚠️ Campos obligatorios incompletos:\n- Servidor (F5)\n- Cantidad (F6)\n- Precio compra/M (F9 — se llena automático al seleccionar servidor)');
    return;
  }

  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  // Agregar fila al log
  log.appendRow([
    fecha,
    asesor           || '',
    servidor         || '',
    cantidad         || '',
    monedaCompra     || 'COP',
    precioCompraUSD  || '',
    totalUSDPagado   || '',
    valorMonedaLocal || '',
    proveedor        || '',
    precioVentaUSD   || '',
    margenUSD        || '',
    gananciaTotal    || '',
    monedaVenta      || 'COP',
    valorVentaLocal  || '',
  ]);

  // Notificar al servidor para resumen diario WhatsApp
  try {
    UrlFetchApp.fetch(SERVER_URL + '/api/compras/register', {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ total_usd: totalUSDPagado, servidor: servidor }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* No interrumpir si el server no responde */ }

  // Limpiar campos de entrada manual (no los automáticos)
  limpiarCompra();

  ss.toast('✅ Compra registrada correctamente', '🔴 COMPRA — ' + servidor, 5);
}

function limpiarCompra() {
  var form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('🚀 Registro Rápido');
  // Limpiar: Servidor, Cantidad, Proveedor, Valor_Moneda_Local, Valor_Venta_Local
  // Conservar: Asesor (F4), Moneda_Compra (F7), Moneda_Venta (F15)
  form.getRange('F5').clearContent();
  form.getRange('F6').clearContent();
  form.getRange('F8').clearContent();
  form.getRange('F11').clearContent();
  form.getRange('F16').clearContent();
}

// ─── REGISTRAR VENTA ─────────────────────────────────────────────────────────

function registrarVenta() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('📝 Ventas');

  if (!log) {
    SpreadsheetApp.getUi().alert('❌ No existe la pestaña "📝 Ventas".');
    return;
  }

  var asesor    = form.getRange('C4').getValue();
  var servidor  = form.getRange('C5').getValue();
  var cantidad  = form.getRange('C6').getValue();
  var metodo    = form.getRange('C7').getValue();
  var canal     = form.getRange('C8').getValue();
  var precioUSD = form.getRange('C9').getValue();
  var totalUSD  = form.getRange('C10').getValue();
  var totalCOP  = form.getRange('C11').getValue();
  var comMP     = form.getRange('C12').getValue();
  var netoUSD   = form.getRange('C13').getValue();

  if (!servidor || !cantidad) {
    SpreadsheetApp.getUi().alert('⚠️ Campos obligatorios incompletos:\n- Servidor (C5)\n- Cantidad (C6)');
    return;
  }

  var juego = getJuegoPorServidor(servidor);
  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  log.appendRow([
    fecha,
    asesor   || '',
    canal    || 'WhatsApp',
    juego    || '',
    servidor || '',
    cantidad || '',
    'Kamas',
    precioUSD ? '$' + precioUSD.toFixed(3) : '',
    totalUSD  ? '$' + totalUSD.toFixed(2)  : '',
    totalUSD  ? '$' + totalUSD.toFixed(2)  : '',
    totalCOP  ? Math.round(totalCOP).toString() : '',
    metodo   || '',
    comMP    ? (comMP * 100).toFixed(2) + '%' : '',
  ]);

  // Notificar servidor
  try {
    UrlFetchApp.fetch(SERVER_URL + '/api/ventas/register', {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ total_usd: totalUSD, servidor: servidor }),
      muteHttpExceptions: true,
    });
  } catch (e) {}

  limpiarVenta();

  ss.toast('✅ Venta registrada correctamente', '💚 VENTA — ' + servidor, 5);
}

function limpiarVenta() {
  var form = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('🚀 Registro Rápido');
  form.getRange('C5').clearContent();
  form.getRange('C6').clearContent();
}

// ─── REGISTRAR INTERCAMBIO ───────────────────────────────────────────────────

function registrarIntercambio() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('🔄 Intercambio');

  if (!log) {
    SpreadsheetApp.getUi().alert('❌ No existe la pestaña "🔄 Intercambio".');
    return;
  }

  var asesor         = form.getRange('I4').getValue();
  var servidorOrigen = form.getRange('I5').getValue();
  var cantidadOrigen = form.getRange('I6').getValue();
  var servidorDest   = form.getRange('I7').getValue();
  var canal          = form.getRange('I8').getValue();
  var precioCompra   = form.getRange('I9').getValue();   // Precio compra origen/M
  var valorRecibido  = form.getRange('I10').getValue();  // Valor USD recibido
  var precioVenta    = form.getRange('I11').getValue();  // Precio venta destino/M
  var mEntregar      = form.getRange('I12').getValue();  // M a entregar
  var costoNuestro   = form.getRange('I13').getValue();
  var gananciaUSD    = form.getRange('I14').getValue();

  if (!servidorOrigen || !servidorDest || !cantidadOrigen) {
    SpreadsheetApp.getUi().alert('⚠️ Campos obligatorios:\n- Servidor ORIGEN (I5)\n- Servidor DESTINO (I7)\n- Cantidad ORIGEN (I6)');
    return;
  }

  var juegoOrigen = getJuegoPorServidor(servidorOrigen);
  var juegoDest   = getJuegoPorServidor(servidorDest);
  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  // Append a la estructura existente: Juego origen | Servidor | Cantidad | Precio compra | Valor total | Juego dest | Servidor | Precio venta | M entregar | Ganancia
  // + columnas adicionales: Fecha, Asesor, Canal (al final para no romper fórmulas existentes)
  log.appendRow([
    juegoOrigen  || '',
    servidorOrigen || '',
    cantidadOrigen || '',
    precioCompra   || '',
    valorRecibido  || '',
    juegoDest      || '',
    servidorDest   || '',
    precioVenta    || '',
    mEntregar      || '',
    gananciaUSD    || '',
    fecha,
    asesor         || '',
    canal          || '',
  ]);

  // Limpiar
  form.getRange('I5:I8').clearContent();

  ss.toast('✅ Intercambio registrado correctamente', '🔄 INTERCAMBIO', 5);
}

/**
 * ═══════════════════════════════════════════════════════════════
 * INSTRUCCIONES PARA CREAR BOTONES CLICABLES EN EL SHEET
 * ═══════════════════════════════════════════════════════════════
 *
 * Las celdas E17, A17, H17 que dicen "▶ REGISTRAR..." son solo texto.
 * Para hacerlas clicables:
 *
 *   1. Click en la celda E17 ("▶  REGISTRAR COMPRA")
 *   2. Menú: Insertar → Dibujo
 *   3. En el editor de dibujos: elegir forma "Rectángulo redondeado"
 *   4. Escribir dentro: "▶  REGISTRAR COMPRA"
 *   5. Darle color de fondo rojo (#cc0000) y texto blanco
 *   6. Guardar y cerrar el dibujo
 *   7. Click derecho sobre el dibujo → Asignar secuencia de comandos
 *   8. Escribir: registrarCompra  (sin paréntesis)
 *   9. Aceptar
 *
 *  Repetir para:
 *   - A17 → función: registrarVenta
 *   - H17 → función: registrarIntercambio
 *
 * ALTERNATIVA MÁS RÁPIDA:
 *   Usar el menú "🎮 Portal Gamers" que aparece en la barra superior
 *   después de ejecutar onOpen() → no necesitas botones gráficos.
 */
