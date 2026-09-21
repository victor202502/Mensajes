# Fase 2 — Sistema de contactos

## Pasos obligatorios antes de desplegar (en orden)

```bash
psql "$DATABASE_URL" -f backend/migrations/001_add_read_at_to_messages.sql   # si no la corriste ya en la Fase 1
psql "$DATABASE_URL" -f backend/migrations/002_create_contacts_table.sql
```

La migración 002 crea la tabla `contacts` **y además migra automáticamente como
contacto "accepted" a cada par de usuarios que ya tuviera al menos un mensaje
entre sí**. Esto es importante — lee la siguiente sección.

No hace falta instalar ninguna dependencia nueva.

## ⚠️ Cambio de comportamiento — léelo con atención

A partir de esta fase, **enviar un mensaje requiere que ambos usuarios sean
contactos aceptados**. Lo implementé porque, si no, "bloquear usuario" no
bloquearía nada de verdad, y "aceptar/rechazar" no tendría ningún efecto real
— habría sido un sistema de contactos cosmético.

Para que esto no rompa nada de lo que ya existía, la migración 002 da de alta
automáticamente como contactos aceptados a todos los que ya se habían escrito
mensajes antes de esta fase. Nadie que pudiera chatear con alguien ayer se
queda fuera hoy.

Si esto **no** era lo que querías (por ejemplo, si preferías que cualquiera
pudiera seguir escribiendo a cualquiera y que "contactos" fuera solo una lista
organizativa, no una restricción), dímelo y lo ajusto — es un cambio de una
sola condición en `server.js`.

## Qué construí

**Backend** (`server.js` — verificado con diff acumulado de las Fases 1+2
contra tu `server.js` original: 0 líneas eliminadas o modificadas, solo
añadidas):
- Tabla `contacts` (`requester_id`, `addressee_id`, `status`: pending/accepted/blocked)
- `GET /api/contacts/overview` → contactos + solicitudes entrantes/salientes + bloqueados, todo en una llamada
- `POST /api/contacts/request`, `.../accept`, `.../reject`, `.../cancel`, `DELETE .../:userId`, `.../block`, `.../unblock`
- Comprobación de contacto aceptado insertada en el `sendMessage` existente (reutiliza tu evento `messageError`, no añadí ningún evento nuevo para esto)

**Frontend:**
- Nuevo `ContactsPanel.jsx` (overlay): búsqueda global + solicitudes entrantes/salientes + bloqueados, con botón de bloquear en cada fila
- `ConversationList` ahora se alimenta de `contacts` (solo aceptados) en vez de `usersList` (todos) — así se cumple "solo contactos aceptados en la pantalla principal". `usersList`/`fetchUsers` **no se tocaron**; ahora alimentan la búsqueda global del panel
- `ChatWindow` gana un menú "..." en el header (Kontakt entfernen / blockieren), con props opcionales — no rompe usos sin esas props
- Botón nuevo con badge de solicitudes pendientes en el header de la lista de conversaciones

## Decisión de diseño que resuelve la pregunta pendiente de la Fase 1
Antes te pregunté si la lista principal debía mostrar solo contactos o todos
los usuarios. Con "únicamente aparecerán los contactos aceptados" ya tengo la
respuesta — implementado así.

## Verificación realizada aquí
- `node --check` sin errores
- Diff línea por línea del `server.js` acumulado (Fases 1+2) contra tu original: únicamente adiciones
- TypeScript en modo sintaxis/JSX sobre los 14 archivos del frontend: 0 errores, 0 imports sin usar
- Confirmé literalmente que `fetchUsers`, `handleSelectUser`, `handleSendMessage`, los 6 eventos de socket y las claves de `localStorage` no cambiaron

## Pendiente de probar por ti
1. Correr ambas migraciones (en orden)
2. Buscar un usuario en el panel de contactos y enviar una solicitud
3. Aceptar/rechazar desde la otra cuenta
4. Cancelar una solicitud enviada
5. Comprobar que **no puedes** enviar mensajes a alguien que no es tu contacto (el error debe aparecer en el status del chat)
6. Bloquear/desbloquear, y confirmar que un usuario bloqueado no puede escribirte ni volver a pedir contacto
7. Eliminar un contacto y comprobar que desaparece de la pantalla principal
8. Que las conversaciones que ya existían antes de esta fase sigan funcionando (gracias al backfill de la migración)
9. Login, registro, logout, responsive
