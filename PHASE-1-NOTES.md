# Fase 1 — Lista de conversaciones

## Paso obligatorio antes de desplegar

Ejecuta la migración SQL **antes** de arrancar el nuevo `server.js` (las rutas nuevas
dependen de la columna `read_at`):

```bash
psql "$DATABASE_URL" -f backend/migrations/001_add_read_at_to_messages.sql
```

Es aditiva (columna nueva, nullable) — no toca datos ni columnas existentes.

No hace falta `npm install` nada nuevo: todo lo añadido usa dependencias que ya
estaban en tu `package.json` (express, pg, socket.io).

## Qué cambió

**Backend** (`server.js` — solo líneas añadidas, verificado con diff línea por línea
contra tu original; ninguna ruta, query ni handler existente fue tocado):
- 3 rutas nuevas: `GET /api/users/status`, `GET /api/conversations/unread`, `POST /api/conversations/:partnerId/read`
- Presencia online en memoria (`presence.js`, módulo nuevo y aislado, con sus propios checks) conectada al `connect`/`disconnect` de Socket.IO existentes
- Nuevo evento de Socket.IO: `userStatusChanged`

**Frontend**:
- `UserList.jsx/.css` → eliminados, sustituidos por `ConversationList.jsx/.css` (preview del último mensaje, hora, buscador, orden por actividad)
- `Avatar.jsx/.css` → nueva prop opcional `isOnline` (punto de estado); los usos existentes sin esa prop se ven exactamente igual que antes
- `ChatWindow.jsx` → nueva prop opcional `isPartnerOnline`, usada solo para el punto del avatar del header. El texto `isConnected`/`statusMessage` (tu propia conexión) no se tocó
- `App.jsx` → nuevo estado (`onlineUserIds`, `unreadCounts`), nuevas funciones (`fetchOnlineStatus`, `fetchUnreadCounts`, `markConversationRead`) siguiendo el mismo patrón que `fetchUsers`/`fetchMessages`; `usersList`/`fetchUsers`/`handleSelectUser` no se modificaron — la lista de conversaciones se calcula aparte con `useMemo`

## Decisión de diseño que quiero que confirmes

La lista muestra **todos** los usuarios (como antes), no solo con los que ya tienes
conversación — los que aún no tienen mensajes aparecen al final, sin preview. Así no
se pierde la posibilidad de iniciar chat con alguien nuevo. Si preferías el
comportamiento estricto de Telegram (ocultar contactos sin conversación), dímelo y lo
ajusto.

## Verificación realizada aquí (sin red ni base de datos reales)

- `node --check` sin errores en los 4 archivos de backend
- Tests reales (no solo sintaxis) de `presence.js`: multi-pestaña, desconexión parcial vs. total, casos límite — todos pasan
- TypeScript en modo sintaxis/JSX sobre los 11 archivos `.jsx`/`.js` del frontend — 0 errores, 0 imports sin usar
- `diff` línea por línea de `server.js` contra tu original — confirmado: solo adiciones, cero líneas eliminadas o modificadas

## Pendiente de probar por ti (no tengo tu base de datos ni backend corriendo)

1. Correr la migración
2. `npm run dev` en backend y frontend
3. Login, registro, logout
4. Mensajes privados + Socket.IO en tiempo real (dos usuarios en pestañas distintas)
5. Que el punto online cambie al conectar/desconectar el otro usuario
6. Que el contador de no leídos suba al recibir mensaje y baje a 0 al abrir la conversación
7. Buscador de conversaciones
8. Responsive
