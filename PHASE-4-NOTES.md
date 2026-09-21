# Fase 4 — Grupos completos

## Paso obligatorio antes de desplegar

```bash
psql "$DATABASE_URL" -f backend/migrations/004_create_groups.sql
```

(Ejecuta también 001-003 si aún no lo hiciste en fases anteriores.)

## Decisiones de diseño importantes (léelas antes de revisar el código)

**1. Los mensajes de grupo viven en una tabla `group_messages` totalmente
separada de `messages`.** No añadí una columna `group_id` a la tabla de 1:1.
Motivo: así es imposible que un mensaje de grupo aparezca por error en
`/api/messages` o en cualquier consulta 1:1 — no tuve que tocar ni un WHERE
de las rutas que ya funcionaban. El coste es algo de código duplicado
(`GroupChatWindow` en vez de reutilizar `ChatWindow`), que asumí a propósito
por seguridad.

**2. "Cambiar avatar" = emoji + degradado, no una imagen subida.** Este
proyecto no tiene (ni tenía) infraestructura para subir archivos, y ya
existía la norma de "sin imágenes, todo generado" desde el rediseño inicial.
Así que el avatar de grupo reutiliza el mismo componente `Avatar` que ya
tenían los usuarios, con un emoji opcional en vez de la inicial.

**3. Invitar solo permite añadir a tus propios contactos**, reutilizando la
misma frontera de confianza de la Fase 2 (no hay un buscador global de
usuarios ajenos para meterlos directo a un grupo).

**4. Si el owner abandona el grupo**, el moderador más antiguo (o si no hay
ninguno, el miembro más antiguo) se convierte automáticamente en owner. Si
el grupo se queda sin nadie, se elimina solo. Esto no estaba en tu lista
explícita, pero sin ello un grupo podía quedar sin owner.

**5. Alcance que dejé fuera a propósito** (para no disparar aún más el
tamaño de esta fase): typing indicator dentro de grupos, y ticks de
entregado/leído por miembro (que en un grupo significan "quién de los N
miembros ya lo vio", una tabla de seguimiento por mensaje y por persona —
bastante más grande que lo de 1:1). El contador de no leídos en grupos sí
lo implementé, pero con un puntero simple "última vez leído" por grupo, no
por mensaje.

## Matriz de permisos implementada

| Acción | Owner | Moderator | Member |
|---|---|---|---|
| Enviar mensajes | ✓ | ✓ | ✓ |
| Editar nombre/descripción/avatar | ✓ | ✓ | ✗ |
| Invitar (solo contactos propios) | ✓ | ✓ | ✗ |
| Expulsar a un member | ✓ | ✓ | ✗ |
| Expulsar a un moderator | ✓ | ✗ | ✗ |
| Ascender/descender moderador | ✓ | ✗ | ✗ |
| Eliminar grupo | ✓ | ✗ | ✗ |
| Abandonar grupo | ✓* | ✓ | ✓ |

*ver punto 4 arriba.

## Qué construí

**Backend** — 3 archivos nuevos (`groupPermissions.js` con tests reales de
la matriz de permisos, más las migraciones) + 12 rutas nuevas + 3 eventos de
socket nuevos (`sendGroupMessage`, `groupUpdated`, `groupDeleted`) + al
conectar, el socket se une automáticamente a las salas de sus grupos; al
expulsar/eliminar, se le hace `socketsLeave` en tiempo real.

**Frontend** — `GroupChatWindow`, `GroupInfoPanel`, `CreateGroupModal`
nuevos; `Avatar` gana una prop `emoji` opcional; `ConversationList` fusiona
1:1 y grupos en una sola lista ordenada por actividad, sin tocar cómo se
seleccionan los contactos existentes.

## Un problema que encontré y corregí yo mismo durante la verificación
Al traducir unos mensajes de error que había escrito en una mezcla rota de
español/alemán (p. ej. "Error al bearbeiten der Gruppe"), mi primer intento
con un script convirtió sin querer todo el archivo `server.js` de CRLF a LF.
Lo detecté en la verificación, lo revertí, y confirmé con diff que el
archivo vuelve a ser byte a byte idéntico al tuyo salvo los cambios
esperados — lo cuento para que veas que la verificación no fue solo
cosmética.

## Verificación
- `node --check` sin errores en los 6 archivos de backend
- Tests reales de `groupPermissions.js` (quién puede expulsar/ascender a quién)
- Diff acumulado de las **4 fases** contra tu `server.js` original: **una sola línea modificada** en total (el `async` del `disconnect`, de la Fase 3)
- TypeScript en modo sintaxis/JSX sobre los 22 archivos del frontend: 0 errores, 0 imports sin usar
- Confirmé literalmente que `fetchUsers`, `handleSendMessage`, `handleLoginSuccess` y la condición original de `handleSelectUser` siguen intactos

## Aviso de mantenimiento (sigue en pie)
`App.jsx` ya tiene ~1000 líneas tras 4 fases. Todo compila y está verificado,
pero es un buen momento para considerar una fase de refactor a hooks
personalizados si vas a seguir añadiendo funcionalidad.

## Pendiente de probar por ti
1. Migración 004
2. Crear un grupo con 2-3 contactos, verificar que cada uno lo ve aparecer al conectar
3. Enviar mensajes en el grupo, en tiempo real desde varias cuentas
4. Ascender a moderador, comprobar que puede invitar/expulsar members pero no a otro moderador
5. Expulsar a alguien y comprobar que dejan de llegarle mensajes de ese grupo al instante
6. Abandonar el grupo siendo owner y comprobar la transferencia automática
7. Cambiar nombre/descripción/emoji del grupo
8. Eliminar el grupo y comprobar que desaparece para todos
9. Todo lo de fases anteriores: login, contactos, mensajería 1:1, tipeo, notificaciones
