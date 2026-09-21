-- backend/migrations/001_add_read_at_to_messages.sql
--
-- Fase 1: soporte para el contador de mensajes sin leer en la lista de
-- conversaciones. Cambio puramente aditivo: nueva columna, nullable,
-- sin valor por defecto obligatorio. No modifica ni elimina ninguna
-- columna existente, por lo que ninguna consulta actual se ve afectada.
--
-- Cómo ejecutarla (una sola vez, antes de desplegar el nuevo server.js):
--   psql "$DATABASE_URL" -f migrations/001_add_read_at_to_messages.sql
-- o pégala directamente en el cliente SQL que ya uses para esta base de datos.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL DEFAULT NULL;
