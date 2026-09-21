-- backend/migrations/003_add_last_seen_and_delivered.sql
--
-- Fase 3: mejoras de mensajería.
-- Ambas columnas son aditivas (nullable, sin valor obligatorio) — ninguna
-- consulta existente se ve afectada.
--
-- - users.last_seen_at   -> se actualiza cuando un usuario se desconecta
--                            del todo (último socket cerrado), para poder
--                            mostrar "últ. vez visto ..." cuando está offline.
-- - messages.delivered_at -> se marca cuando el cliente receptor confirma
--                            (ack) que recibió el newMessage en tiempo real.
--
-- Cómo ejecutarla:
--   psql "$DATABASE_URL" -f backend/migrations/003_add_last_seen_and_delivered.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL DEFAULT NULL;
