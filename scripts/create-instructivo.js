const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1scyWtKMcdbO1CmvjYCm0Cev7kjHVhqvqxg_bTN7ciDM';
const TAB_NAME = '📋 INSTRUCTIVO';

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '..', 'sheets-key.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const C_DARK  = { red: 0.051, green: 0.106, blue: 0.165 }; // #0d1b2a
const C_GOLD  = { red: 0.961, green: 0.620, blue: 0.043 }; // #f59e0b
const C_WHITE = { red: 1,     green: 1,     blue: 1     };
const C_BLACK = { red: 0,     green: 0,     blue: 0     };
const C_YELL  = { red: 1,     green: 0.980, blue: 0.800 };
const C_RED   = { red: 0.8,   green: 0.1,   blue: 0.1   };
const C_SUB   = { red: 0.1,   green: 0.18,  blue: 0.28  };

const ROWS = [
  ['GUÍA DE USO — PORTAL GAMERS LATAM', 'title'],
  ['Solo para uso interno del equipo', 'normal'],
  ['Última actualización: Mayo 2026', 'normal'],
  ['', 'blank'],

  ['SECCIÓN 1 — BIENVENIDA', 'header'],
  ['Esta guía es para el equipo interno. Seguir los procedimientos aquí descritos para garantizar una atención profesional y consistente.', 'normal'],
  ['', 'blank'],

  ['SECCIÓN 2 — PESTAÑAS DEL SHEET', 'header'],
  ['📊 CONFIGURACIÓN CENTRAL', 'subheader'],
  ['  - Tasas de cambio: actualizar DIARIAMENTE', 'normal'],
  ['  - Los precios de la tienda se calculan automáticamente', 'normal'],
  ['  - NO modificar columnas con fórmulas', 'normal'],
  ['  - Actualizar tasa COP, VES, CLP, MXN cada día', 'normal'],
  ['', 'blank'],
  ['📦 VENTAS (registro automático)', 'subheader'],
  ['  - Se llena automáticamente cuando el cliente confirma pedido', 'normal'],
  ['  ESTADOS POSIBLES:', 'normal'],
  ['  PENDIENTE → verificar pago y entregar', 'normal'],
  ['  ENTREGADO → pedido completado', 'normal'],
  ['  CANCELADO → pedido no completado', 'normal'],
  ['  - Cambiar estado manualmente después de entregar', 'normal'],
  ['  ⚠️ NUNCA borrar filas de ventas', 'alert'],
  ['', 'blank'],
  ['🔥 OFERTAS', 'subheader'],
  ['  - Activo = SI → aparece en web como oferta', 'normal'],
  ['  - Activo = NO → no aparece en web', 'normal'],
  ['  - Badge opciones: HOT, OFERTA, NUEVO, LIMITADO', 'normal'],
  ['  - Precio_Oferta debe ser menor que Precio_Normal', 'normal'],
  ['  - Descuento actual configurado: 7%', 'normal'],
  ['', 'blank'],
  ['💰 WOW_GOLD', 'subheader'],
  ['  - Precios de WoW Gold por región (Americas y Europe)', 'normal'],
  ['  - Actualizar cuando cambie el precio de la ficha', 'normal'],
  ['  - Referencia diaria: https://undermine.exchange', 'normal'],
  ['  - Columnas: Compra y Venta por moneda', 'normal'],
  ['', 'blank'],
  ['📋 INSTRUCTIVO (esta pestaña)', 'subheader'],
  ['  - Solo lectura, no modificar', 'normal'],
  ['', 'blank'],

  ['SECCIÓN 3 — FLUJO COMPLETO DE ATENCIÓN AL CLIENTE', 'header'],
  ['PASO 1 → Cliente hace pedido', 'subheader'],
  ['  - Desde la web: portalgamerslatam.com', 'normal'],
  ['  - Desde WhatsApp: +57 322 3427456', 'normal'],
  ['  - El pedido llega automáticamente a tu WhatsApp', 'normal'],
  ['', 'blank'],
  ['PASO 2 → Verificar el pago', 'subheader'],
  ['  - Revisar Nequi / Daviplata / Llave según método elegido', 'normal'],
  ['  - Confirmar monto y nombre del titular', 'normal'],
  ['  ⚠️ Si no coincide → contactar al cliente ANTES de entregar', 'alert'],
  ['', 'blank'],
  ['PASO 3 → Entregar el producto', 'subheader'],
  ['  - Entrar al juego con la cuenta de la tienda', 'normal'],
  ['  - Buscar el personaje del cliente (usuario en juego)', 'normal'],
  ['  - Entregar la cantidad exacta de Kamas / Silver / Gold', 'normal'],
  ['  - Tiempo máximo: 5 minutos (WoW hasta 30 min)', 'normal'],
  ['', 'blank'],
  ['PASO 4 → Registrar la entrega', 'subheader'],
  ['  - Ir a pestaña VENTAS en el Sheet', 'normal'],
  ['  - Buscar el pedido (por nombre o usuario en juego)', 'normal'],
  ['  - Cambiar estado de PENDIENTE → ENTREGADO', 'normal'],
  ['', 'blank'],
  ['PASO 5 → Post-entrega', 'subheader'],
  ['  - Si cliente no responde en 10 min → enviar mensaje de seguimiento', 'normal'],
  ['  - Si hay problema → escalar al dueño', 'normal'],
  ['', 'blank'],

  ['SECCIÓN 4 — MANEJO DEL BOT DE WHATSAPP', 'header'],
  ['Número de la tienda: +57 322 3427456', 'normal'],
  ['', 'blank'],
  ['ESTADOS DEL BOT', 'subheader'],
  ['  ✅ ACTIVO → responde automáticamente a clientes', 'normal'],
  ['  ⏸️ PAUSADO → cuando cliente solicita asesor humano', 'normal'],
  ['', 'blank'],
  ['CUANDO EL BOT ESTÁ PAUSADO', 'subheader'],
  ['  - Te llega notificación especial con 🎧 emoji', 'normal'],
  ['  - Debes atender manualmente al cliente', 'normal'],
  ['  - El bot NO responde mientras está pausado', 'normal'],
  ['  - Cliente debe escribir "menu" para reactivar el bot', 'normal'],
  ['', 'blank'],
  ['COMANDOS QUE ENTIENDE EL BOT', 'subheader'],
  ["  'hola', 'menu', 'inicio' → menú principal", 'normal'],
  ["  'catalogo', 'precios' → lista de precios en tiempo real", 'normal'],
  ["  'pedido', '2' → iniciar proceso de compra", 'normal'],
  ["  'asesor', '4' → solicitar atención humana", 'normal'],
  ["  'cancelar' → cancelar y volver al menú", 'normal'],
  ['', 'blank'],

  ['SECCIÓN 5 — REGLAS DE PRECIOS Y DESCUENTOS', 'header'],
  ['  ⚠️ NUNCA modificar precios sin autorización del dueño', 'alert'],
  ['  ⚠️ NUNCA dar precios diferentes a los de la web', 'alert'],
  ['  ⚠️ NUNCA prometer entregas fuera del horario', 'alert'],
  ['', 'blank'],
  ['Para actualizar precios:', 'subheader'],
  ['  1. El dueño indica el nuevo precio', 'normal'],
  ['  2. Actualizar en pestaña CONFIGURACIÓN CENTRAL', 'normal'],
  ['  3. Los precios en la web se actualizan automáticamente', 'normal'],
  ['', 'blank'],
  ['Para activar una oferta:', 'subheader'],
  ['  1. Ir a pestaña OFERTAS', 'normal'],
  ['  2. Cambiar Activo de NO → SI', 'normal'],
  ['  3. La oferta aparece en web en máximo 5 minutos', 'normal'],
  ['', 'blank'],
  ['Descuento máximo autorizado sin consultar: 5%', 'normal'],
  ['  ⚠️ Mayor descuento: consultar SIEMPRE al dueño', 'alert'],
  ['', 'blank'],

  ['SECCIÓN 6 — HORARIOS Y CONTACTOS', 'header'],
  ['HORARIOS DE ATENCIÓN', 'subheader'],
  ['  Lunes a Domingo: 10:00 AM – 10:00 PM (hora Colombia)', 'normal'],
  ['', 'blank'],
  ['CONTACTOS INTERNOS', 'subheader'],
  ['  WhatsApp tienda (atención clientes): +57 322 3427456', 'normal'],
  ['  Dueño (SOLO emergencias graves): +57 3016008994', 'normal'],
  ['', 'blank'],
  ['EMERGENCIAS — cuándo llamar al dueño:', 'subheader'],
  ['  ⚠️ Sistema caído por más de 30 minutos', 'alert'],
  ['  ⚠️ Pago recibido pero no se puede entregar', 'alert'],
  ['  ⚠️ Cliente amenaza con denuncia o chargeback', 'alert'],
  ['  ⚠️ Problema técnico grave en la web', 'alert'],
  ['', 'blank'],
  ['NO llamar al dueño por:', 'subheader'],
  ['  - Dudas de precio (consultar sheet)', 'normal'],
  ['  - Clientes molestos (seguir el protocolo)', 'normal'],
  ['  - Preguntas del bot (manejarlas manualmente)', 'normal'],
  ['', 'blank'],

  ['SECCIÓN 7 — GUÍA DE ENTREGA POR JUEGO', 'header'],
  ['🎮 DOFUS RETRO / DOFUS 3.0 / DOFUS TOUCH', 'subheader'],
  ['  - Entrar al servidor indicado por el cliente', 'normal'],
  ['  - Ir a la ciudad principal del servidor', 'normal'],
  ['  - Buscar el personaje del cliente', 'normal'],
  ['  - Intercambio directo o mercado', 'normal'],
  ['  - Tiempo máximo: 5 minutos', 'normal'],
  ['', 'blank'],
  ['⚔️ ALBION ONLINE', 'subheader'],
  ['  - Conectar en servidor America', 'normal'],
  ['  - Entregar en ciudad principal acordada', 'normal'],
  ['  - Silver va directo al personaje', 'normal'],
  ['  - Tiempo máximo: 10 minutos', 'normal'],
  ['', 'blank'],
  ['🌿 WAKFU', 'subheader'],
  ['  - Conectar en servidor del cliente', 'normal'],
  ['  - Entrega directa al personaje', 'normal'],
  ['  - Tiempo máximo: 5 minutos', 'normal'],
  ['', 'blank'],
  ['💎 WOW GOLD — THE WAR WITHIN', 'subheader'],
  ['  - Conectar en región indicada (Americas o Europe)', 'normal'],
  ['  - Enviar gold por correo del juego (buzón)', 'normal'],
  ['  - Asunto del correo: Portal Gamers LATAM', 'normal'],
  ['  - Tiempo: 5–30 minutos', 'normal'],
  ['  ⚠️ Precio varía según ficha: revisar undermine.exchange antes de entregar', 'alert'],
];

function cellFmt(type) {
  const border = { style: 'SOLID', width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } };
  const borders = { top: border, bottom: border, left: border, right: border };
  switch (type) {
    case 'title':
      return { backgroundColor: C_DARK, textFormat: { foregroundColor: C_GOLD, bold: true, fontSize: 14 }, borders, wrapStrategy: 'WRAP' };
    case 'header':
      return { backgroundColor: C_DARK, textFormat: { foregroundColor: C_GOLD, bold: true, fontSize: 12 }, borders, wrapStrategy: 'WRAP' };
    case 'subheader':
      return { backgroundColor: C_SUB, textFormat: { foregroundColor: C_GOLD, bold: true, fontSize: 10 }, borders, wrapStrategy: 'WRAP' };
    case 'alert':
      return { backgroundColor: C_YELL, textFormat: { foregroundColor: C_RED, bold: true, fontSize: 10 }, borders, wrapStrategy: 'WRAP' };
    case 'blank':
      return { backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 }, textFormat: { foregroundColor: C_BLACK, fontSize: 10 }, borders, wrapStrategy: 'WRAP' };
    default:
      return { backgroundColor: C_WHITE, textFormat: { foregroundColor: C_BLACK, fontSize: 10 }, borders, wrapStrategy: 'WRAP' };
  }
}

async function run() {
  const client = await auth.getClient();
  const api = google.sheets({ version: 'v4', auth: client });

  // Check for existing tab
  const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets.find(s => s.properties.title === TAB_NAME);

  if (existing) {
    console.log(`Eliminando pestaña existente (ID: ${existing.properties.sheetId})...`);
    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] },
    });
  }

  // Create fresh tab
  const createRes = await api.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: TAB_NAME,
            gridProperties: { rowCount: ROWS.length + 10, columnCount: 2 },
          },
        },
      }],
    },
  });

  const sheetId = createRes.data.replies[0].addSheet.properties.sheetId;
  console.log(`Pestaña creada (ID: ${sheetId}). Aplicando formato...`);

  await api.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        // Column A width ~700px
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 700 },
            fields: 'pixelSize',
          },
        },
        // Freeze first row
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Write all rows with formatting
        {
          updateCells: {
            range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endRowIndex: ROWS.length, endColumnIndex: 1 },
            rows: ROWS.map(([text, type]) => ({
              values: [{ userEnteredValue: { stringValue: text }, userEnteredFormat: cellFmt(type) }],
            })),
            fields: 'userEnteredValue,userEnteredFormat',
          },
        },
      ],
    },
  });

  console.log(`\n✅ Pestaña "${TAB_NAME}" lista con ${ROWS.length} filas.`);
  console.log('   - Encabezados: azul oscuro + texto dorado');
  console.log('   - Alertas: fondo amarillo + texto rojo');
  console.log('   - Columna A: 700px de ancho');
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
