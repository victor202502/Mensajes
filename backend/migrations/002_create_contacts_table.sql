-- backend/migrations/002_create_contacts_table.sql
--
-- Fase 2: sistema de contactos.
--
-- 1) Crea la tabla `contacts`. Una fila representa una relación entre dos
--    usuarios:
--      status = 'pending'  -> requester_id envió una solicitud a addressee_id
--      status = 'accepted' -> ambos son contactos (la dirección ya no importa)
--      status = 'blocked'  -> requester_id ha bloqueado a addressee_id
--
-- 2) Migra automáticamente como contactos 'accepted' a todos los pares de
--    usuarios que YA tenían al menos un mensaje entre sí. Esto es necesario
--    para no romper ninguna conversación existente: a partir de este cambio
--    el envío de mensajes requiere ser contactos aceptados (ver server.js),
--    así que sin este backfill cualquiera que ya estuviera chateando con
--    alguien se quedaría bloqueado de golpe.
--
-- Cómo ejecutarla:
--   psql "$DATABASE_URL" -f backend/migrations/002_create_contacts_table.sql

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'blocked'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_addressee_status ON contacts (addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_requester_status ON contacts (requester_id, status);

-- Backfill: cada par de usuarios con al menos un mensaje existente pasa a
-- ser un contacto 'accepted'. Se normaliza el par con LEAST/GREATEST para
-- insertar una única fila por pareja, sin duplicados.
INSERT INTO contacts (requester_id, addressee_id, status)
SELECT DISTINCT
  LEAST(sender_id, recipient_id) AS requester_id,
  GREATEST(sender_id, recipient_id) AS addressee_id,
  'accepted'
FROM messages
WHERE recipient_id IS NOT NULL
ON CONFLICT (requester_id, addressee_id) DO NOTHING;
