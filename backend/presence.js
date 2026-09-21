// backend/presence.js
// Reine In-Memory-Verwaltung der aktuell online verbundenen Benutzer.
// Bewusst ohne Express-/Socket.IO-Abhängigkeiten gehalten, damit sich die
// Logik isoliert testen lässt (siehe presence.test.js).
//
// Ein Benutzer kann mehrere Sockets gleichzeitig haben (mehrere Tabs/Geräte).
// Er gilt erst dann als offline, wenn der letzte seiner Sockets getrennt wurde.

const onlineSockets = new Map(); // userId (number) -> Set<socketId>

function markOnline(userId, socketId) {
  if (!onlineSockets.has(userId)) {
    onlineSockets.set(userId, new Set());
  }
  onlineSockets.get(userId).add(socketId);
}

/**
 * Entfernt einen Socket für einen Benutzer.
 * @returns {boolean} true, wenn der Benutzer dadurch komplett offline gegangen ist
 *                     (es war sein letzter verbleibender Socket).
 */
function markOffline(userId, socketId) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
}

function isOnline(userId) {
  return onlineSockets.has(userId);
}

function getOnlineUserIds() {
  return Array.from(onlineSockets.keys());
}

module.exports = { markOnline, markOffline, isOnline, getOnlineUserIds };
