// frontend/src/components/Avatar.jsx
import React from 'react';
import { getAvatarGradient, getInitial } from '../utils/avatarColor';
import './Avatar.css';

// Rein visuelle Komponente: zeigt einen kreisförmigen Avatar mit Initiale.
// Nimmt keinen Einfluss auf Business-Logik, Props oder Datenfluss der App.
// NEU (Phase 1): optionale Prop `isOnline` (boolean) zeigt einen kleinen
// Status-Punkt in der Ecke. Wird sie nicht übergeben (wie an allen bisherigen
// Stellen), ändert sich am gerenderten Ergebnis nichts.
// NEU (Phase 4): optionale Prop `emoji` — wenn gesetzt (Gruppen-Avatar), wird
// dieses Zeichen statt der Initiale angezeigt. Ohne diese Prop (alle
// bisherigen Verwendungen) verhält sich die Komponente exakt wie zuvor.
const Avatar = ({ name, size = 'md', isOnline, emoji }) => (
  <span className={`avatar-wrapper avatar-wrapper-${size}`}>
    <span
      className={`avatar avatar-${size}`}
      style={{ background: getAvatarGradient(name) }}
      aria-hidden="true"
    >
      {emoji || getInitial(name)}
    </span>
    {typeof isOnline === 'boolean' && (
      <span
        className={`avatar-status-dot ${isOnline ? 'is-online' : 'is-offline'}`}
        aria-hidden="true"
      />
    )}
  </span>
);

export default Avatar;
