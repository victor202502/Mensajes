# Fase 4 — Segunda ronda de estabilización

Sigo sin tocar la Fase 5. Los 4 arreglos de la ronda anterior (limpieza de
`activeGroupDetail`, descarte de respuestas asíncronas tardías, validaciones
defensivas, transacción de creación) se mantienen intactos — los revisé de
nuevo antes de tocar nada más.

## Los 3 puntos que pediste verificar — los 3 eran reales

**1. Orden de rutas de Express — CONFIRMADO, era un bug real y serio.**
`GET /api/groups/:groupId` estaba registrada ANTES que `GET /api/groups/messages`
y `GET /api/groups/read-state`. Express prueba las rutas en el orden en que
se registran: una petición a `/api/groups/messages` coincidía primero con
`:groupId` (tratando literalmente "messages" como si fuera un groupId),
así que la ruta correcta nunca se llegaba a ejecutar — devolvía 400
"Ungültige groupId" en su lugar. Las moví antes de `:groupId` y escribí un
verificador automático que recorre **todas** las rutas del archivo
comprobando que ninguna dinámica tape a una literal registrada después, en
ningún método HTTP — no solo estas dos, todo el archivo. Resultado: limpio.

**2. Conversión de memberIds — confirmado, corregido.**
Antes: `Number.isInteger(id)` directo sobre los valores recibidos, que
descarta en silencio cualquier ID que llegue como string numérico ("5" en
vez de 5). Ahora: `parseInt(id, 10)` primero, `Number.isInteger` después.
Probé la función aislada con numbers, strings numéricos, mezclas y basura
real — se comporta como debe en los 5 casos.

**3. Notificación en tiempo real al crear grupo — confirmado, faltaba.**
Las rutas de invitar/editar/expulsar/abandonar ya emitían `groupUpdated` a
la sala del grupo; la ruta de CREAR grupo no lo hacía — así que un miembro
recién añadido en la creación no veía el grupo aparecer hasta recargar
manualmente. Añadido, igual que en las demás rutas.

## Verificación de estos 3 puntos
- Script propio que recorre las 16 rutas GET/POST/PATCH/DELETE del archivo comprobando el orden correcto — 0 problemas encontrados
- Función de parseo de memberIds probada con 5 casos reales (numbers, strings, mezcla, basura, no-array)
- `node --check` sin errores
- Diff contra tu `server.js` original: sigue siendo **una sola línea modificada** en todo el proyecto

## Tu checklist de 9 pruebas — verificación por código (ver limitación abajo)

| Prueba | Estado por código |
|---|---|
| Crear grupo | ✓ transacción atómica, ruta ya no tapada |
| Añadir miembros | ✓ parseInt corregido, comprobación de contacto intacta |
| Abrir grupo | ✓ ya no usa datos de otro grupo (ronda anterior) |
| Enviar mensajes | ✓ groupId correcto (ronda anterior) + membresía correcta (transacción) |
| Persistencia en PostgreSQL | SQL correcto; no puedo verificar la escritura real sin tu DB |
| Recargar la página | ✓ las 3 rutas de recarga ya no están tapadas |
| Otro usuario recibe el mensaje | ✓ se une a la sala + ahora recibe `groupUpdated` al crearse |
| Abandonar grupo | ✓ sin cambios en esta ronda, ya verificado antes |
| Volver a entrar | Si te referías a volver a *entrar a la app* tras abandonar: ✓ el grupo dejado ya no aparece en tu lista. Si te referías a *reingresar al grupo abandonado*: no hay auto-reingreso, necesitas que alguien te vuelva a invitar (mismo diseño de la Fase 4, no es un bug) |

**Limitación que sigo sin poder evitar:** no tengo tu base de datos ni
servidor corriendo, así que "persistencia real" y el resto de la tabla como
experiencia de usuario en vivo solo los puedes confirmar tú. Todo lo demás
lo verifiqué con pruebas reales ejecutadas aquí, no solo leyendo el código.

Los logs `[DEBUG Phase 4]` de la ronda anterior siguen activos a propósito,
por si esta ronda no resuelve todo — bórralos cuando confirmes que ya no
los necesitas.
