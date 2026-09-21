-- backend/migrations/004_create_groups.sql
--
-- Fase 4: sistema de grupos completo.
--
-- DECISIÓN DE DISEÑO IMPORTANTE: los mensajes de grupo viven en una tabla
-- `group_messages` completamente SEPARADA de `messages` (la de 1:1), en vez
-- de añadir una columna group_id nullable a `messages`. Motivo: así es
-- matemáticamente imposible que un mensaje de grupo aparezca por error en
-- /api/messages o en cualquier consulta 1:1 existente — no hace falta tocar
-- ni un WHERE de las rutas que ya funcionan.
--
-- avatar_emoji: el grupo NO usa imágenes subidas (no hay infraestructura de
-- subida de archivos en este proyecto, ni la había pedido antes). "Cambiar
-- avatar" se implementa igual que el resto de la app: un emoji/inicial sobre
-- el mismo círculo con degradado ya usado para los avatares de usuario.
--
-- Cómo ejecutarla:
--   psql "$DATABASE_URL" -f backend/migrations/004_create_groups.sql

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  avatar_emoji VARCHAR(10) NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'owner' | 'moderator' | 'member'
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);

CREATE TABLE IF NOT EXISTS group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, created_at);

-- Letzter gelesener Zeitpunkt pro Mitglied und Gruppe (Basis für den
-- Ungelesen-Zähler, analog zu read_at bei 1:1-Nachrichten, aber als
-- einzelner Zeiger statt pro Nachricht).
CREATE TABLE IF NOT EXISTS group_read_state (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
