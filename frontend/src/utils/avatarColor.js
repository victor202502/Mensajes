// frontend/src/utils/avatarColor.js
// Rein visuelle Hilfsfunktionen: erzeugen eine deterministische Akzentfarbe
// und die Initiale für Avatare, basierend auf dem Benutzernamen.
// Keine Business-Logik, kein State, keine Seiteneffekte.

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7c3aed, #a78bfa)',
  'linear-gradient(135deg, #db2777, #f472b6)',
  'linear-gradient(135deg, #0891b2, #22d3ee)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #d97706, #fbbf24)',
  'linear-gradient(135deg, #4f46e5, #818cf8)',
  'linear-gradient(135deg, #dc2626, #f87171)',
];

export function getAvatarGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

export function getInitial(name = '') {
  return name.charAt(0).toUpperCase() || '?';
}
