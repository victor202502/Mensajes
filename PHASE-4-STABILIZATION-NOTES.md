# Fase 4 — Corrección de regresiones (sin funcionalidad nueva)

No se ha implementado nada de la Fase 5. Este paquete solo corrige la Fase 4.

## Causa raíz real (confirmada leyendo el código, no por intuición)

**`activeGroupDetail` no se limpiaba al cambiar de grupo.**

En `App.jsx`, `handleSelectGroup` hacía esto:
```js
setSelectedChatUser(null);
setActiveGroupId(groupId);       // se actualiza YA
fetchGroupDetail(groupId);       // asíncrono, tarda un instante
```
`activeGroupId` cambiaba al instante, pero `activeGroupDetail` (de donde
`GroupChatWindow` y `GroupInfoPanel` sacan `group.id` y `group.members`)
seguía teniendo los datos del grupo ANTERIOR hasta que la petición
`fetchGroupDetail` respondía. Durante esa ventana:

- Si enviabas un mensaje, se enviaba con el `groupId` del grupo viejo, no
  del que acababas de abrir → de ahí el 403 "no eres miembro" o el mensaje
  yendo al grupo equivocado.
- Si el owner era nuevo en ese grupo y aún no había llegado la respuesta,
  parecía que "no pertenece al grupo" aunque sí pertenecía — el dato que se
  estaba mirando era, literalmente, el de otro grupo.
- Si invitabas a alguien desde el panel de info durante esa ventana, la
  invitación se mandaba al grupo viejo, no al que veías (o creías ver).

Además encontré una **condición de carrera de verdad**: si cambiabas de
grupo dos veces rápido, la respuesta de la primera petición podía llegar
DESPUÉS de la segunda y sobrescribir los datos correctos con datos viejos.

No encontré, revisando todo el código de selección/checkbox de
`CreateGroupModal` y `GroupInfoPanel` línea por línea, ningún sitio donde se
use el índice de un array en vez de `user.id` — todo el código de selección
de miembros usa `c.id`/`member.id` directamente. Así que si después de este
fix sigues viendo que se añade una persona distinta a la que seleccionaste
(no solo al grupo equivocado), dímelo con los logs de depuración activados
(ver abajo) — con eso localizamos el punto exacto en una vuelta.

## Los 3 cambios que hice

**1. `handleSelectGroup` ahora limpia `activeGroupDetail` inmediatamente:**
```js
setSelectedChatUser(null);
setActiveGroupDetail(null); // <- el fix
setActiveGroupId(groupId);
fetchGroupDetail(groupId);
```
Así nunca se puede renderizar ni usar el detalle de un grupo distinto al
seleccionado — como mucho verás un instante en blanco mientras carga.

**2. `fetchGroupDetail` descarta respuestas que lleguen tarde** (la condición
de carrera): comprueba, cuando la respuesta llega, si sigues en ese mismo
grupo (`activeGroupIdRef.current === groupId`); si ya cambiaste a otro,
ignora la respuesta en vez de aplicarla.

**3. Validaciones defensivas** en `fetchGroupDetail`, `markGroupRead`,
`handleSelectGroup`, `handleSendGroupMessage`, `editGroup`,
`inviteGroupMember`, `kickGroupMember`, `changeGroupMemberRole`,
`leaveGroup`, `deleteGroup`: ninguna dispara ya una petición si `groupId`/
`userId` no es un entero válido. Confirmé además que las 10 rutas backend
con `:groupId` ya validaban esto — ahí no hacía falta tocar nada.

## Lo que añadí en el backend (robustez, no funcionalidad)

**Creación de grupo ahora es una transacción real.** Antes, grupo + owner +
miembros eran 3 escrituras sueltas: si una fallaba a medio camino, el grupo
y el owner quedaban guardados igualmente aunque el cliente viera un error
500 — un estado a medias. Añadí `db.withTransaction()` (nuevo, aditivo, no
toca `db.query()`) y lo probé de verdad (no solo sintaxis): confirmé que
hace `COMMIT` si todo va bien y `ROLLBACK` + relanza el error si algo falla
a medio camino.

Revisé el esquema completo (`groups`, `group_members`, `group_messages`,
`group_read_state`, `contacts`): claves foráneas, `ON DELETE CASCADE`,
índices, restricciones `UNIQUE` — todo correcto, no hizo falta tocar nada
del esquema.

## Logs temporales de depuración (quítalos cuando confirmes que todo va bien)

Añadí `console.log('[DEBUG Phase 4] ...')` en los puntos que pediste:
usuario autenticado, groupId/userId recibidos, memberIds seleccionados vs.
insertados, resultado de `getMemberRole`. Búscalos por `[DEBUG Phase 4]` en
consola del navegador y en los logs del servidor — están marcados también
con comentarios `TEMPORÄR (Debug Phase 4)` en el código para que sea fácil
encontrarlos y borrarlos después.

## Verificación hecha aquí (sin servidor/DB reales, ver limitación abajo)
- `node --check` sin errores en los 5 archivos de backend tocados
- `withTransaction` probado de verdad: commit en éxito, rollback + relanza error en fallo
- Matriz de permisos (`groupPermissions.js`) re-confirmada: owner/moderator/member exactamente como antes, sin regresión
- Diff línea por línea contra tu `server.js` original: sigue siendo **una sola línea modificada** en total (el `async` del `disconnect`, ya conocido) — estos arreglos son aditivos o tocan solo código que yo mismo escribí en la Fase 4
- TypeScript en modo sintaxis/JSX sobre todo el frontend: 0 errores

**Limitación importante:** este sandbox no tiene tu base de datos ni un
servidor corriendo, así que no puedo reproducir tu sesión de navegador
exacta ni confirmar al 100% que esto resuelve cada síntoma que viste. Lo que
sí puedo decir con certeza es que encontré un bug real y concreto, lo arreglé,
y lo verifiqué hasta donde el entorno lo permite. Los logs temporales están
para que la siguiente vuelta (si hace falta) sea mucho más rápida.

## Tu checklist (11 puntos) — estado

✓ Verificado por código: owner insertado en la misma transacción que el
grupo (no depende de otra petición), matriz de permisos intacta, cambiar
nombre/descripción sigue la misma ruta de siempre (no tocada salvo el
mensaje de error).

Pendiente de que confirmes tú en vivo: crear grupo → enviar → recibir por
Socket.IO → abandonar → expulsar — con los logs `[DEBUG Phase 4]` activados,
para que si algo sigue fallando lo veamos en el acto.
