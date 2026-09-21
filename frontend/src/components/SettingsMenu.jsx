// frontend/src/components/SettingsMenu.jsx
// NEU (Phase 3): dezentes Dropdown für Benachrichtigungs-/Sound-Einstellungen.
// Reine Präsentationskomponente — der eigentliche Zustand lebt in App.jsx.
import React, { useState } from 'react';
import { FiSettings, FiBell, FiBellOff, FiVolume2, FiVolumeX } from 'react-icons/fi';
import './SettingsMenu.css';

const SettingsMenu = ({ notificationsEnabled, onToggleNotifications, soundEnabled, onToggleSound }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="settings-menu-wrapper">
      <button
        type="button"
        className="settings-menu-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Einstellungen"
        title="Einstellungen"
      >
        <FiSettings />
      </button>
      {isOpen && (
        <div className="settings-menu-dropdown">
          <button type="button" className="settings-menu-item" onClick={onToggleNotifications}>
            {notificationsEnabled ? <FiBell /> : <FiBellOff />}
            <span className="settings-menu-item-label">Browser-Benachrichtigungen</span>
            <span className={`settings-toggle-pill ${notificationsEnabled ? 'is-on' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className="settings-menu-item" onClick={onToggleSound}>
            {soundEnabled ? <FiVolume2 /> : <FiVolumeX />}
            <span className="settings-menu-item-label">Sound bei neuer Nachricht</span>
            <span className={`settings-toggle-pill ${soundEnabled ? 'is-on' : ''}`} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
