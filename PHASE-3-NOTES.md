# Fase 3 — Mejoras de mensajería

## Paso obligatorio antes de desplegar

```bash
psql "$DATABASE_URL" -f backend/migrations/003_add_last_seen_and_delivered.sql
```

(Ejecuta también las migraciones 001 y 002 si aún no lo hiciste en fases anteriores.)

## Ya estaba hecho — no lo he vuelto a tocar

De tu lista de 9 puntos, **2 ya existían desde la Fase 1** y no necesitaban nada
nuevo: **online/offline** (estado real vía Socket.IO) y **contador de mensajes
sin leer**. Los otros 7 son nuevos en esta fase.

## Qué construí

**Backend** (`server.js` — diff acumulado de las 3 fases contra tu original:
solo 1 línea modificada en todo el proyecto — `disconnect` pasó a `async` para
poder guardar `last_seen_at`— el resto son adiciones puras):
- `users.last_seen_at` y `messages.delivered_at` (migración 003)
- Eventos de socket nuevos: `typing` → `partnerTyping` (con comprobación de contacto), `ackDelivered` → `messageStatusUpdate`
- `/api/messages` y `/api/contacts/overview` ahora incluyen `deliveredAt`/`readAt` y `lastSeenAt` (campos añadidos, nada existente tocado)
- La ruta de "marcar como leído" (Fase 1) ahora también avisa en tiempo real al remitente (`messagesRead`)

**Frontend:**
- Indicador "tippt gerade..." en el header del chat (burbuja de 3 puntos), con timeout automático de 3s
- "Zuletzt online: vor X Min." cuando el contacto está offline
- Ticks de estado en tus propios mensajes: ✓ enviado, ✓✓ gris entregado, ✓✓ azul leído
- `utils/notificationSound.js` — sonido sintetizado con Web Audio API (sin archivos externos)
- `SettingsMenu.jsx` nuevo — activar/desactivar notificaciones del navegador y sonido, guardado en `localStorage` (son ajustes del dispositivo, no de la cuenta: sobreviven al logout a propósito)
- Notificación del navegador al recibir un mensaje de una conversación que no tienes abierta; clic en la notificación enfoca la ventana y abre esa conversación

## Verificación
- `node --check` sin errores
- Diff acumulado (Fases 1+2+3) contra tu `server.js` original: **1 sola línea modificada** (el `async` del disconnect), el resto solo adiciones
- TypeScript en modo sintaxis/JSX sobre los 16 archivos del frontend: 0 errores, 0 imports sin usar
- Confirmé literalmente que `fetchUsers`, `handleSelectUser`, `handleSendMessage` y las claves `authToken`/`user` de `localStorage` no cambiaron

## Un aviso de mantenimiento (no bloqueante)
`App.jsx` ya tiene ~700 líneas tras 3 fases. Sigue siendo válido y probado, pero
si en una fase futura quieres que lo divida en hooks personalizados (p. ej.
`useSocket`, `useContacts`) para que sea más fácil de mantener, dímelo — sería
un buen candidato para una fase dedicada solo a refactor, sin tocar funcionalidad.

## Pendiente de probar por ti
1. Correr la migración 003
2. Escribir en un chat abierto en otra pestaña/cuenta y ver "tippt gerade..."
3. Cerrar sesión en una cuenta y ver "Zuletzt online: vor X Min." en la otra
4. Enviar un mensaje y ver pasar el tick de ✓ a ✓✓ gris a ✓✓ azul al abrir la conversación en el otro lado
5. Activar notificaciones y sonido, minimizar la pestaña, y probar que llega la notificación (con permiso del navegador)
6. Login, registro, logout, contactos, mensajería privada, responsive — todo lo de fases anteriores
