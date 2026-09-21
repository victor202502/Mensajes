// frontend/src/components/ContactsPanel.jsx
// NEU (Phase 2): zentrale Oberfläche für das Kontakt-System.
//
// Reine Präsentationskomponente — kompletter Datenfluss (Suche, Listen,
// Aktionen) kommt als Props von App.jsx, genau wie bei den anderen
// Komponenten dieses Projekts. Öffnet sich als Overlay über der App.
import React, { useState } from 'react';
import { FiSearch, FiX, FiSlash } from 'react-icons/fi';
import Avatar from './Avatar';
import './ContactsPanel.css';

function getRelationshipStatus(userId, { contacts, incoming, outgoing, blocked }) {
  if (contacts.some((c) => c.id === userId)) return 'accepted';
  if (blocked.some((c) => c.id === userId)) return 'blocked';
  if (incoming.some((c) => c.id === userId)) return 'incoming';
  if (outgoing.some((c) => c.id === userId)) return 'outgoing';
  return 'none';
}

const ContactsPanel = ({
  isOpen,
  onClose,
  allUsers,
  contacts,
  incoming,
  outgoing,
  blocked,
  onSendRequest,
  onAccept,
  onReject,
  onCancel,
  onBlock,
  onUnblock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const query = searchQuery.trim().toLowerCase();
  const searchResults = query
    ? allUsers.filter((u) => u.username.toLowerCase().includes(query))
    : [];

  const renderActions = (targetUser) => {
    const status = getRelationshipStatus(targetUser.id, { contacts, incoming, outgoing, blocked });

    if (status === 'accepted') {
      return <span className="contacts-status-label">Bereits Kontakt</span>;
    }
    if (status === 'blocked') {
      return (
        <button onClick={() => onUnblock(targetUser.id)} className="btn-ghost-sm">
          Entsperren
        </button>
      );
    }
    return (
      <div className="contacts-inline-actions">
        {status === 'outgoing' && (
          <button onClick={() => onCancel(targetUser.id)} className="btn-ghost-sm">
            Zurückziehen
          </button>
        )}
        {status === 'incoming' && (
          <>
            <button onClick={() => onAccept(targetUser.id)} className="btn-accept-sm">
              Annehmen
            </button>
            <button onClick={() => onReject(targetUser.id)} className="btn-reject-sm">
              Ablehnen
            </button>
          </>
        )}
        {status === 'none' && (
          <button onClick={() => onSendRequest(targetUser.id)} className="btn-request-sm">
            Anfrage senden
          </button>
        )}
        <button
          onClick={() => onBlock(targetUser.id)}
          className="btn-icon-sm"
          aria-label={`${targetUser.username} blockieren`}
          title="Blockieren"
        >
          <FiSlash />
        </button>
      </div>
    );
  };

  const renderList = (title, users, emptyText) => {
    if (users.length === 0) return null;
    return (
      <div className="contacts-section">
        <h4>{title}</h4>
        <ul className="contacts-list">
          {users.map((u) => (
            <li key={u.id} className="contacts-list-item">
              <Avatar name={u.username} size="sm" />
              <span className="contacts-list-name">{u.username}</span>
              {renderActions(u)}
            </li>
          ))}
        </ul>
        {users.length === 0 && emptyText && <p className="contacts-empty">{emptyText}</p>}
      </div>
    );
  };

  const hasAnyList = incoming.length > 0 || outgoing.length > 0 || blocked.length > 0;

  return (
    <div className="contacts-overlay" onClick={onClose}>
      <div className="contacts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="contacts-panel-header">
          <h3>Kontakte</h3>
          <button className="contacts-close-btn" onClick={onClose} aria-label="Kontakte schließen">
            <FiX />
          </button>
        </div>

        <div className="contacts-search">
          <FiSearch className="contacts-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Benutzer suchen..."
            className="contacts-search-input"
            aria-label="Benutzer suchen"
          />
        </div>

        <div className="contacts-panel-body">
          {query ? (
            <div className="contacts-section">
              <h4>Suchergebnisse</h4>
              {searchResults.length === 0 ? (
                <p className="contacts-empty">Keine Benutzer gefunden.</p>
              ) : (
                <ul className="contacts-list">
                  {searchResults.map((u) => (
                    <li key={u.id} className="contacts-list-item">
                      <Avatar name={u.username} size="sm" />
                      <span className="contacts-list-name">{u.username}</span>
                      {renderActions(u)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {renderList('Eingehende Anfragen', incoming)}
              {renderList('Gesendete Anfragen', outgoing)}
              {renderList('Blockierte Benutzer', blocked)}
              {!hasAnyList && (
                <p className="contacts-empty">
                  Suche oben nach einem Benutzernamen, um eine Kontaktanfrage zu senden.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsPanel;
