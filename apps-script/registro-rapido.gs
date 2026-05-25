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

// ─── Utilidades internas de compra ───────────────────────────────────────────

function _setupComprasHeaders(log) {
  if (log.getLastRow() === 0 || !log.getRange('A1').getValue()) {
    log.getRange('A1:J1').setValues([[
      'FECHA','ASESOR','SERVIDOR','CANTIDAD_M','MONEDA_COMPRA',
      'PRECIO_COMPRA_USD','TOTAL_USD_PAGADO','VALOR_MONEDA_LOCAL','PROVEEDOR','CANAL'
    ]]);
  }
}

function actualizarStock(ss, servidor, cantidad, totalUSDPagado, fecha) {
  var stock = ss.getSheetByName('📦 Stock');
  if (!stock) {
    stock = ss.insertSheet('📦 Stock');
    stock.getRange('A1:D1').setValues([['SERVIDOR','STOCK_M','ULTIMA_COMPRA','TOTAL_INVERTIDO_USD']]);
  }
  var datos = stock.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === servidor) {
      stock.getRange(i + 1, 2).setValue((Number(datos[i][1]) || 0) + (Number(cantidad) || 0));
      stock.getRange(i + 1, 3).setValue(fecha);
      stock.getRange(i + 1, 4).setValue((Number(datos[i][3]) || 0) + (Number(totalUSDPagado) || 0));
      return;
    }
  }
  stock.appendRow([servidor, Number(cantidad) || 0, fecha, Number(totalUSDPagado) || 0]);
}

function inicializarStock() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var stock = ss.getSheetByName('Stock Y Cuentas Base');
  if (!stock) stock = ss.insertSheet('Stock Y Cuentas Base');

  stock.clearContents();
  stock.getRange('A1:I1').setValues([[
    'JUEGO','SERVIDOR','CUENTA/APODO','STOCK_M','STOCK_MAX','VALOR_USD','VALOR_COP','ESTADO','ALERTA'
  ]]);

  var precios = ss.getSheetByName('💰 Precios');
  if (!precios) { ss.toast('No se encontró la hoja 💰 Precios', '❌ Error', 4); return; }

  var datos = precios.getRange('A6:O30').getValues();
  var rows  = [];
  var juego = '';

  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0]) juego = String(datos[i][0]).trim();
    var servidor = datos[i][1];
    if (!servidor || !String(servidor).trim()) continue;
    var srv = String(servidor).trim();
    if (srv.startsWith('📈') || srv.toUpperCase().startsWith('MARGEN')) continue;
    var valorUSD = datos[i][2] || '';
    var valorCOP = datos[i][8] || '';
    rows.push([juego, srv, '', 0, 0, valorUSD, valorCOP, '', '']);
  }

  if (!rows.length) { ss.toast('No se encontraron servidores en Precios', '⚠️ Aviso', 4); return; }

  stock.getRange(2, 1, rows.length, 9).setValues(rows);

  var copF    = [];
  var estadoF = [];
  var alertaF = [];
  for (var r = 2; r <= rows.length + 1; r++) {
    copF.push(['=F' + r + '*4000']);
    estadoF.push(['=IF(D' + r + '>0,1,0)']);
    alertaF.push(['=IF(AND(E' + r + '>0,D' + r + '<E' + r + '*0.2),1,0)']);
  }
  stock.getRange(2, 7, rows.length, 1).setFormulas(copF);
  stock.getRange(2, 8, rows.length, 1).setFormulas(estadoF);
  stock.getRange(2, 9, rows.length, 1).setFormulas(alertaF);

  for (var f = 4; f <= 20; f++) {
    stock.getRange(f, 7).setFormula('=F' + f + '*4000');
    stock.getRange(f, 8).setFormula('=IF(D' + f + '>0,1,0)');
    stock.getRange(f, 9).setFormula('=IF(AND(E' + f + '>0,D' + f + '<E' + f + '*0.2),1,0)');
  }

  stock.getRange('H4:H20').setNumberFormat('[=1]"Disponible";[=0]"Sin stock"');
  stock.getRange('I4:I20').setNumberFormat('[=1]"REABASTECER";[=0]""');

  ss.toast('Stock inicializado: ' + rows.length + ' servidores', '📦 Stock Y Cuentas Base', 5);
}

function _ajustarStockBase(ss, servidor, delta) {
  var stock = ss.getSheetByName('Stock Y Cuentas Base');
  if (!stock) return null;
  var datos = stock.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][1]).trim() === String(servidor).trim()) {
      var nuevo = (Number(datos[i][3]) || 0) + delta;
      stock.getRange(i + 1, 4).setValue(nuevo);
      return nuevo;
    }
  }
  return null;
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

  var asesor           = form.getRange('F4').getValue();
  var servidor         = form.getRange('F5').getValue();
  var cantidad         = form.getRange('F6').getValue();
  var monedaCompra     = form.getRange('F7').getValue();
  var proveedor        = form.getRange('F8').getValue();
  var precioCompraUSD  = form.getRange('F9').getValue();
  var totalUSDPagado   = form.getRange('F10').getValue();
  var valorMonedaLocal = form.getRange('F11').getValue();

  if (!servidor || !cantidad || !precioCompraUSD) {
    SpreadsheetApp.getUi().alert('⚠️ Campos obligatorios incompletos:\n- Servidor (F5)\n- Cantidad (F6)\n- Precio compra/M (F9 — se llena automático al seleccionar servidor)');
    return;
  }

  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  _setupComprasHeaders(log);
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
    '',
  ]);

  actualizarStock(ss, servidor, cantidad, totalUSDPagado, fecha);
  _ajustarStockBase(ss, servidor, Number(cantidad));

  try {
    UrlFetchApp.fetch(SERVER_URL + '/api/compras/register', {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ total_usd: totalUSDPagado, servidor: servidor }),
      muteHttpExceptions: true,
    });
  } catch (e) {}

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

  var nuevoStockV = _ajustarStockBase(ss, servidor, -Number(cantidad));
  if (nuevoStockV !== null && nuevoStockV < 0) {
    ss.toast('Stock negativo: ' + nuevoStockV + 'M en ' + servidor + '. Verifica inventario.', '⚠️ Stock', 6);
  }

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

// ─── TRIGGER: clic en fila 17 activa el registro correspondiente ─────────────

function onSelectionChange(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== '🚀 Registro Rápido') return;
  const row = range.getRow();
  const col = range.getColumn();
  if (row === 17 && col >= 1 && col <= 3) { registrarVenta_silencioso(); return; }
  if (row === 17 && col >= 4 && col <= 7) { registrarCompra_silencioso(); return; }
  if (row === 17 && col >= 8 && col <= 10) { registrarIntercambio_silencioso(); return; }
}

// ─── Versiones silenciosas (sin UI dialogs — para onSelectionChange) ─────────

function registrarVenta_silencioso() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('📝 Ventas');

  if (!log) { ss.toast('No existe la pestaña "📝 Ventas"', '❌ Error', 4); return; }

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
    ss.toast('Campos obligatorios: Servidor (C5), Cantidad (C6)', '⚠️ Incompleto', 4);
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

  try {
    UrlFetchApp.fetch(SERVER_URL + '/api/ventas/register', {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ total_usd: totalUSD, servidor: servidor }),
      muteHttpExceptions: true,
    });
  } catch (e) {}

  limpiarVenta();

  var nuevoStockVs = _ajustarStockBase(ss, servidor, -Number(cantidad));
  if (nuevoStockVs !== null && nuevoStockVs < 0) {
    ss.toast('Stock negativo: ' + nuevoStockVs + 'M en ' + servidor + '. Verifica inventario.', '⚠️ Stock', 6);
  }

  ss.toast('Venta registrada correctamente', '💚 VENTA — ' + servidor, 5);
}

function registrarCompra_silencioso() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('📋 Compras');

  if (!log) { ss.toast('No existe la pestaña "📋 Compras"', '❌ Error', 4); return; }

  var asesor           = form.getRange('F4').getValue();
  var servidor         = form.getRange('F5').getValue();
  var cantidad         = form.getRange('F6').getValue();
  var monedaCompra     = form.getRange('F7').getValue();
  var proveedor        = form.getRange('F8').getValue();
  var precioCompraUSD  = form.getRange('F9').getValue();
  var totalUSDPagado   = form.getRange('F10').getValue();
  var valorMonedaLocal = form.getRange('F11').getValue();

  if (!servidor || !cantidad || !precioCompraUSD) {
    ss.toast('Campos: Servidor (F5), Cantidad (F6), Precio compra/M (F9)', '⚠️ Incompleto', 4);
    return;
  }

  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  _setupComprasHeaders(log);
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
    '',
  ]);

  actualizarStock(ss, servidor, cantidad, totalUSDPagado, fecha);
  _ajustarStockBase(ss, servidor, Number(cantidad));

  try {
    UrlFetchApp.fetch(SERVER_URL + '/api/compras/register', {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ total_usd: totalUSDPagado, servidor: servidor }),
      muteHttpExceptions: true,
    });
  } catch (e) {}

  limpiarCompra();
  ss.toast('Compra registrada correctamente', '🔴 COMPRA — ' + servidor, 5);
}

function registrarIntercambio_silencioso() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var form = ss.getSheetByName('🚀 Registro Rápido');
  var log  = ss.getSheetByName('🔄 Intercambio');

  if (!log) { ss.toast('No existe la pestaña "🔄 Intercambio"', '❌ Error', 4); return; }

  var asesor         = form.getRange('I4').getValue();
  var servidorOrigen = form.getRange('I5').getValue();
  var cantidadOrigen = form.getRange('I6').getValue();
  var servidorDest   = form.getRange('I7').getValue();
  var canal          = form.getRange('I8').getValue();
  var precioCompra   = form.getRange('I9').getValue();
  var valorRecibido  = form.getRange('I10').getValue();
  var precioVenta    = form.getRange('I11').getValue();
  var mEntregar      = form.getRange('I12').getValue();
  var costoNuestro   = form.getRange('I13').getValue();
  var gananciaUSD    = form.getRange('I14').getValue();

  if (!servidorOrigen || !servidorDest || !cantidadOrigen) {
    ss.toast('Campos: Servidor ORIGEN (I5), DESTINO (I7), Cantidad (I6)', '⚠️ Incompleto', 4);
    return;
  }

  var juegoOrigen = getJuegoPorServidor(servidorOrigen);
  var juegoDest   = getJuegoPorServidor(servidorDest);
  var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');

  log.appendRow([
    juegoOrigen    || '',
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

  form.getRange('I5:I8').clearContent();
  ss.toast('Intercambio registrado correctamente', '🔄 INTERCAMBIO', 5);
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

function redisenarSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('🚀 Registro Rápido');
  if (!sheet) { Browser.msgBox('Hoja no encontrada'); return; }
  var C = {
    bg:'#0f0f1a', panel:'#1a1a2e', campo:'#16213e',
    verde:'#065f46', verdeNeon:'#10b981',
    rojo:'#7f1d1d', rojoNeon:'#ef4444',
    morado:'#4c1d95', moradoNeon:'#8b5cf6',
    amarillo:'#fbbf24', textoSec:'#a0a0c0', textoVal:'#6ee7b7'
  };
  sheet.getRange('A1:J35').setBackground(C.bg).setFontColor(C.textoSec).setFontFamily('Roboto Mono').setFontSize(9);
  sheet.getRange('A1:J1').setBackground('#0d0d1f').setFontColor(C.moradoNeon).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A3:C3').setBackground(C.verde).setFontColor(C.verdeNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('E3:G3').setBackground(C.rojo).setFontColor(C.rojoNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('H3:J3').setBackground(C.morado).setFontColor(C.moradoNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  ['B4:B13','E4:E13','H4:H13'].forEach(function(r){sheet.getRange(r).setBackground(C.campo).setFontColor(C.textoSec).setFontSize(9);});
  ['C4:C13','F4:G13','I4:I13'].forEach(function(r){sheet.getRange(r).setBackground(C.panel).setFontColor(C.textoVal).setFontSize(9);});
  sheet.getRange('B13:C13').setBackground('#064e3b').setFontColor(C.verdeNeon).setFontWeight('bold');
  sheet.getRange('E13:G13').setBackground('#064e3b').setFontColor(C.verdeNeon).setFontWeight('bold');
  sheet.getRange('H13:I13').setBackground('#064e3b').setFontColor(C.verdeNeon).setFontWeight('bold');
  sheet.getRange('E14:G14').setBackground('#1c1c0a').setFontColor(C.amarillo).setFontWeight('bold').setFontSize(10);
  sheet.getRange('A17:C17').setBackground(C.verde).setFontColor(C.verdeNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('E17:G17').setBackground(C.rojo).setFontColor(C.rojoNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('H17:J17').setBackground(C.morado).setFontColor(C.moradoNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('A18:J18').setBackground('#1e1b4b').setFontColor(C.moradoNeon).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange('A19:C19').setBackground(C.verde).setFontColor(C.verdeNeon).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('E19:G19').setBackground(C.rojo).setFontColor(C.rojoNeon).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('H19:J19').setBackground(C.morado).setFontColor(C.moradoNeon).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A20:C35').setBackground(C.panel).setFontColor(C.textoSec).setFontSize(9);
  sheet.getRange('E20:G35').setBackground(C.panel).setFontColor(C.textoSec).setFontSize(9);
  sheet.getRange('H20:J35').setBackground(C.panel).setFontColor(C.textoSec).setFontSize(9);
  sheet.setRowHeight(1,42); sheet.setRowHeight(2,22); sheet.setRowHeight(3,28);
  for(var i=4;i<=16;i++) sheet.setRowHeight(i,26);
  sheet.setRowHeight(17,34); sheet.setRowHeight(18,28); sheet.setRowHeight(19,26);
  sheet.setColumnWidth(1,15); sheet.setColumnWidth(2,140); sheet.setColumnWidth(3,110);
  sheet.setColumnWidth(4,15); sheet.setColumnWidth(5,140); sheet.setColumnWidth(6,80);
  sheet.setColumnWidth(7,50); sheet.setColumnWidth(8,140); sheet.setColumnWidth(9,110);
  sheet.setColumnWidth(10,15);
  SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().setHiddenGridlines(true);
  ss.toast('🎮 Rediseño gaming aplicado','✅ Portal Gamers LATAM',4);
}
