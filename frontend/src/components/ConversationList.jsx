// frontend/src/components/ConversationList.jsx
// NEU (Phase 1): ersetzt UserList.jsx. Die Liste ist nicht mehr nur eine reine
// Benutzerliste, sondern zeigt Konversations-Vorschauen im Telegram-Stil.
//
// Erhält angereicherte Objekte über die Prop `conversations`:
//   { id, username, isOnline, lastMessageContent, lastMessageAt, unreadCount }
// (berechnet in App.jsx aus den bereits vorhandenen usersList/allMessages-Daten).
// NEU (Phase 4): dieselbe Liste enthält jetzt zusätzlich Gruppen-Einträge mit
// `isGroup: true` und `emoji` statt `isOnline`.
//
// WICHTIG für Kompatibilität: onSelectUser wird für 1:1-Einträge weiterhin
// exakt wie zuvor bei UserList nur mit { id, username } aufgerufen — App.jsx/
// handleSelectUser und der komplette bestehende Auswahl-/Chat-Datenfluss
// bleiben dadurch unverändert. Gruppen rufen stattdessen die NEUE, separate
// Prop onSelectGroup auf.
import React, { useState } from 'react';
import { FiSearch, FiUserPlus, FiUsers } from 'react-icons/fi';
import Avatar from './Avatar';
import './ConversationList.css';

const formatPreviewTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

const ConversationList = ({
  conversations,
  onSelectUser,
  selectedUserId,
  onOpenContacts,
  pendingRequestCount,
  onSelectGroup, // NEU (Phase 4)
  activeGroupId, // NEU (Phase 4)
  onOpenCreateGroup, // NEU (Phase 4)
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const items = conversations || [];
  const filtered = items.filter((c) =>
    c.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleItemClick = (conv) => {
    if (conv.isGroup) {
      onSelectGroup(conv.id);
    } else {
      onSelectUser({ id: conv.id, username: conv.username });
    }
  };

  const isItemSelected = (conv) => (conv.isGroup ? conv.id === activeGroupId : conv.id === selectedUserId);

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h4>Unterhaltungen</h4>
        <div className="conversation-header-actions">
          {/* NEU (Phase 4): neue Gruppe erstellen */}
          <button
            type="button"
            className="conversation-contacts-btn"
            onClick={onOpenCreateGroup}
            aria-label="Neue Gruppe erstellen"
            title="Neue Gruppe erstellen"
          >
            <FiUsers />
          </button>
          {/* NEU (Phase 2): Zugang zum Kontakt-System (Suche, Anfragen, blockierte Benutzer) */}
          <button
            type="button"
            className="conversation-contacts-btn"
            onClick={onOpenContacts}
            aria-label="Kontakte verwalten"
            title="Kontakte verwalten"
          >
            <FiUserPlus />
            {pendingRequestCount > 0 && <span className="conversation-contacts-badge">{pendingRequestCount}</span>}
          </button>
        </div>
      </div>

      <div className="conversation-search">
        <FiSearch className="conversation-search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Unterhaltung suchen..."
          className="conversation-search-input"
          aria-label="Unterhaltungen durchsuchen"
        />
      </div>

      {filtered.length === 0 && (
        <p className="conversation-list-empty">
          {items.length > 0 ? 'Keine Unterhaltung gefunden.' : 'Keine anderen Benutzer verfügbar.'}
        </p>
      )}

      <ul className="conversation-list-items">
        {filtered.map((conv) => (
          <li
            key={`${conv.isGroup ? 'group' : 'user'}-${conv.id}`}
            onClick={() => handleItemClick(conv)}
            className={`conversation-item ${isItemSelected(conv) ? 'is-selected' : ''}`}
            title={conv.isGroup ? conv.username : `Chatten mit ${conv.username}`}
          >
            <Avatar name={conv.username} size="md" isOnline={conv.isGroup ? undefined : conv.isOnline} emoji={conv.isGroup ? conv.emoji : undefined} />
            <div className="conversation-item-main">
              <div className="conversation-item-top">
                <span className="conversation-item-name">{conv.username}</span>
                {conv.lastMessageAt && (
                  <span className="conversation-item-time">{formatPreviewTime(conv.lastMessageAt)}</span>
                )}
              </div>
              <div className="conversation-item-bottom">
                <span className="conversation-item-preview">
                  {conv.lastMessageContent || 'Noch keine Nachrichten'}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="conversation-item-badge">{conv.unreadCount}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConversationList;
