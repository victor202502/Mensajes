// backend/groupPermissions.js
// Helfer für die Rollen-/Rechteprüfung in Gruppen (Phase 4).
//
// Rollen: 'owner' | 'moderator' | 'member'
// Rechte-Matrix (siehe PHASE-4-NOTES.md für die vollständige Tabelle):
//   - Gruppe bearbeiten (Name/Beschreibung/Avatar), einladen: owner + moderator
//   - Mitglieder entfernen: owner (jeden außer sich selbst), moderator (nur 'member')
//   - Rolle ändern (befördern/degradieren), Gruppe löschen: nur owner
//   - Nachricht senden, Gruppe verlassen: jedes Mitglied

const db = require('./db');

async function getMemberRole(groupId, userId) {
  const result = await db.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].role : null;
}

// Bearbeiten der Gruppe (Metadaten) und Einladen neuer Mitglieder
function canManageGroup(role) {
  return role === 'owner' || role === 'moderator';
}

// Darf `actorRole` ein Mitglied mit `targetRole` entfernen?
function canKick(actorRole, targetRole) {
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'moderator') return targetRole === 'member';
  return false;
}

// Nur der Owner darf Rollen ändern oder die Gruppe löschen
function isOwner(role) {
  return role === 'owner';
}

module.exports = { getMemberRole, canManageGroup, canKick, isOwner };
