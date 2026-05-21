# WhatsApp Bot — Guía de configuración

## Variables de entorno (Railway)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `WHATSAPP_PHONE_ID` | ID del número de teléfono en Meta | `123456789012345` |
| `WHATSAPP_TOKEN` | Token de acceso permanente de la app | `EAABs...` |
| `WHATSAPP_VERIFY_TOKEN` | Token secreto para verificar el webhook | `portalgamers2024` |
| `WHATSAPP_TIENDA` | Número que recibe pedidos y solicitudes de asesor | `573223427456` |
| `WHATSAPP_DUENO` | Número que recibe SOLO el resumen diario | `573016008994` |

> **IMPORTANTE:** `WHATSAPP_DUENO` NUNCA recibe mensajes de clientes. Solo el resumen de las 22:00.

## Configurar la App en Meta Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com) → tu app de WhatsApp Business.
2. En **WhatsApp > Configuración**, copiar el **Phone Number ID** y generar un **Token permanente**.
3. En **Webhooks**, hacer clic en **Editar**:
   - **URL de callback:** `https://<tu-dominio-railway>/webhook/whatsapp`
   - **Token de verificación:** el valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
4. Suscribirse al campo `messages`.
5. Hacer clic en **Verificar y guardar** — el endpoint GET responderá con el challenge.

## Flujo del bot

```
INICIO / MENU
  ├── 1 → Catálogo de precios
  ├── 2 → Hacer pedido
  │     ├── Selección de juego
  │     ├── Selección de servidor
  │     ├── Cantidad (millones)
  │     ├── País → métodos de pago + resumen
  │     ├── Nick/usuario en el juego
  │     ├── "PAGUÉ" → registra en Sheets + notifica TIENDA
  │     └── Pedido completado
  ├── 3 → Info estado de pedido
  └── 4 → Solicitar asesor → notifica TIENDA, pausa bot
```

## Números configurados por defecto

- **TIENDA** (`WHATSAPP_TIENDA`): `+57 322 3427456` — Recibe pedidos + solicitudes asesor
- **DUEÑO** (`WHATSAPP_DUENO`): `+57 301 6008994` — Recibe SOLO resumen diario (22:00)

## Resumen diario

Se envía automáticamente a las **22:00 hora Colombia** al número del dueño.
Incluye: pedidos recibidos, total vendido en USD, solicitudes de asesor.

## Comandos globales del bot

| Mensaje | Acción |
|---|---|
| `hola`, `menu`, `inicio`, `start` | Menú principal |
| `cancelar`, `cancel`, `salir` | Limpiar sesión + menú |
| `asesor`, `humano`, `persona` | Solicitar asesor |
| `PAGUÉ` (y variantes) | Confirmar pago |

## Notas de despliegue

- El bot funciona en modo webhook (no polling).
- Las sesiones expiran a los 30 minutos de inactividad.
- Los precios se leen de Google Sheets con cache de 5 minutos.
- Si no hay conexión a Sheets, usa los precios de `data/products.json`.
