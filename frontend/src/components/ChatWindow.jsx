// frontend/src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiArrowLeft, FiMoreVertical, FiUserMinus, FiSlash, FiCheck, FiClock } from 'react-icons/fi';
import MessageInput from './MessageInput'; // Stelle sicher, dass die Texte hier auch übersetzt sind
import Avatar from './Avatar';
import './ChatWindow.css';

// NEU (Phase 3): zeigt vor der Uhrzeit den Zustellstatus einer eigenen Nachricht an.
// Rein visuelle Ableitung aus den Feldern der Nachricht selbst — keine eigene Logik.
const MessageStatusTicks = ({ message }) => {
  if (!message.id) {
    return <FiClock className="message-status-icon message-status-pending" aria-label="Wird gesendet" />;
  }
  if (message.readAt) {
    return (
      <span className="message-status-ticks message-status-read" aria-label="Gelesen">
        <FiCheck /><FiCheck />
      </span>
    );
  }
  if (message.deliveredAt) {
    return (
      <span className="message-status-ticks message-status-delivered" aria-label="Zugestellt">
        <FiCheck /><FiCheck />
      </span>
    );
  }
  return (
    <span className="message-status-ticks message-status-sent" aria-label="Gesendet">
      <FiCheck />
    </span>
  );
};

// NEU (Phase 3): formatiert den "zuletzt online"-Zeitpunkt eines offline Partners.
const formatLastSeen = (dateString) => {
  if (!dateString) return 'Offline';
  const date = new Date(dateString);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Zuletzt online: gerade eben';
  if (diffMin < 60) return `Zuletzt online: vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Zuletzt online: vor ${diffHours} Std.`;
  return `Zuletzt online: ${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}`;
};

// --- Komponente ChatWindow (Modifiziert) ---
// Erhält alles als Props von App.jsx:
// - currentUser: Das Objekt des angemeldeten Benutzers { id, username, ... }
// - chatPartner: Das Objekt des Benutzers, mit dem gechattet wird { id, username } oder null
// - messages: Array der GEFILTERTEN Nachrichten für dieses spezifische Gespräch
// - onSendMessage: Callback-Funktion zum Senden einer Nachricht (in App.jsx definiert)
// - statusMessage: Statusnachricht des Sockets (z. B. "Verbunden.", "Fehler...")
// - isConnected: Boolean, der den Verbindungsstatus des Sockets anzeigt
// - onBackToList: NEU (rein visuell) — optionaler Callback für den "Zurück"-Button im
//   mobilen Layout. Ruft in App.jsx lediglich den bereits vorhandenen setSelectedChatUser(null)
//   auf (dieselbe Funktion, die auch handleLogout schon nutzt). Kein neuer State, keine neue Logik.
// - isPartnerOnline: NEU (Phase 1) — Online-Status des Chat-Partners (nicht zu verwechseln
//   mit `isConnected`, das weiterhin die eigene Socket-Verbindung beschreibt und unverändert
//   bleibt). Nur für den Status-Punkt am Avatar im Header verwendet.
// - onRemoveContact / onBlockContact: NEU (Phase 2) — optionale Callbacks für das
//   Options-Menü im Header. Rein additiv, wie onBackToList: ohne sie wird einfach
//   kein Menü angezeigt.
// - onTyping / isPartnerTyping / partnerLastSeenAt: NEU (Phase 3) — Tipp-Indikator und
//   "zuletzt online". Alle optional/additiv.

const ChatWindow = ({ currentUser, chatPartner, messages, onSendMessage, statusMessage, isConnected, onBackToList, isPartnerOnline, onRemoveContact, onBlockContact, onTyping, isPartnerTyping, partnerLastSeenAt }) => {
  // Referenz für das automatische Scrollen der Nachrichtenliste
  const messageListRef = useRef(null);
  // NEU (Phase 2): rein lokaler UI-Zustand für das Options-Menü im Header
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Funktion zum Scrollen nach unten ---
  const scrollToBottom = () => {
    if (messageListRef.current) {
      const lastMessage = messageListRef.current.lastElementChild;
      if (lastMessage) {
          lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
         messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    }
  };

  // --- Effekt zum Scrollen, wenn sich die Nachrichten (Prop) ändern ---
  useEffect(() => {
    const timer = setTimeout(() => {
        scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // NEU (Phase 2): Options-Menü schließen, sobald die Konversation gewechselt wird
  useEffect(() => {
    setIsMenuOpen(false);
  }, [chatPartner?.id]);

  // --- Funktion zum Behandeln des Nachrichtenversands ---
  const handleSendMessage = (content) => {
     if (chatPartner && content) {
        console.log(`ChatWindow: Nachricht für ${chatPartner.username} wird an App.jsx übergeben`); // Log geändert
        onSendMessage({ recipientUsername: chatPartner.username, content });
     } else {
        console.warn("ChatWindow: Versuch, Nachricht ohne chatPartner oder Inhalt zu senden."); // Log geändert
     }
  };

  // NEU (Phase 3): Tipp-Events an den richtigen Partner weiterreichen
  const handleTyping = () => {
    if (onTyping && chatPartner) {
      onTyping(chatPartner.id);
    }
  };

  // --- Bedingtes Rendern, wenn kein Benutzer ausgewählt ist ---
  if (!chatPartner) {
    return (
      <div className="chat-window-placeholder">
        <div className="chat-placeholder-icon"><FiMessageCircle /></div>
        {/* <<< CAMBIO: Texte übersetzt >>> */}
        <h2>Willkommen, {currentUser?.username}!</h2>
        <p className="chat-placeholder-text">Wähle einen Benutzer aus der Liste links, um mit dem Chatten zu beginnen.</p>
        <p className={`chat-status ${isConnected ? 'is-online' : ''}`}>
            <span className="status-dot" />
            {/* Zeigt den Status (der bereits in App.jsx übersetzt sein sollte) */}
             {statusMessage} {isConnected ? '(Verbunden)' : '(Getrennt)'}
         </p>
      </div>
    );
  }

  // --- Haupt-Rendering, wenn ein Benutzer ausgewählt ist ---
  return (
    <div className="chat-window">
      {/* Chat-Header */}
      <div className="chat-header">
        {onBackToList && (
          <button
            type="button"
            className="chat-back-btn"
            onClick={onBackToList}
            aria-label="Zurück zur Benutzerliste"
          >
            <FiArrowLeft />
          </button>
        )}
        <Avatar name={chatPartner.username} size="md" isOnline={isPartnerOnline} />
        <div className="chat-header-info">
          {/* <<< CAMBIO: Text übersetzt >>> */}
          <h3>{chatPartner.username}</h3>
          {/* NEU (Phase 3): Tipp-Anzeige bzw. Online-/Zuletzt-online-Status des Partners */}
          <p className="chat-partner-presence">
            {isPartnerTyping ? (
              <span className="chat-typing-indicator">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                tippt gerade...
              </span>
            ) : isPartnerOnline ? (
              'Online'
            ) : (
              formatLastSeen(partnerLastSeenAt)
            )}
          </p>
          <p className={`chat-status ${isConnected ? 'is-online' : ''}`}>
            <span className="status-dot" />
             {/* Zeigt den Status (der bereits in App.jsx übersetzt sein sollte) */}
             {statusMessage} {isConnected ? '(Verbunden)' : '(Getrennt)'}
          </p>
        </div>

        {/* NEU (Phase 2): Options-Menü — nur sichtbar, wenn die entsprechenden Callbacks übergeben wurden */}
        {(onRemoveContact || onBlockContact) && (
          <div className="chat-menu-wrapper">
            <button
              type="button"
              className="chat-menu-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Weitere Optionen"
              title="Weitere Optionen"
            >
              <FiMoreVertical />
            </button>
            {isMenuOpen && (
              <div className="chat-menu-dropdown">
                {onRemoveContact && (
                  <button
                    type="button"
                    className="chat-menu-item"
                    onClick={() => { setIsMenuOpen(false); onRemoveContact(chatPartner.id); }}
                  >
                    <FiUserMinus /> Kontakt entfernen
                  </button>
                )}
                {onBlockContact && (
                  <button
                    type="button"
                    className="chat-menu-item chat-menu-item-danger"
                    onClick={() => { setIsMenuOpen(false); onBlockContact(chatPartner.id); }}
                  >
                    <FiSlash /> Benutzer blockieren
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nachrichtenliste */}
      <div ref={messageListRef} className="message-list">
        {/* Nachricht, wenn das Gespräch leer ist */}
        {messages.length === 0 && (
          <p className="message-list-empty">
            {/* <<< CAMBIO: Text übersetzt >>> */}
            <i>Keine Nachrichten in diesem Gespräch. Sende die erste!</i>
          </p>
        )}

        {/* Mapping der als Prop empfangenen Nachrichten */}
        {messages.map((msg) => (
          <div
            key={msg.id || `temp-${msg.sender.id}-${msg.content.substring(0, 5)}-${Date.now()}`}
            className={`message ${msg.sender.id === currentUser.id ? 'message-own' : 'message-received'}`}
          >
            {/* Inhalt der Nachricht */}
            <div className="message-content">{msg.content}</div>
            {/* Zeitstempel */}
            <div className="message-time">
              {/* <<< CAMBIO: Text übersetzt >>> */}
              {/* Zeigt 'Senden...' wenn createdAt noch nicht vorhanden ist */}
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'}
              {/* NEU (Phase 3): Zustellstatus nur bei eigenen Nachrichten */}
              {msg.sender.id === currentUser.id && <MessageStatusTicks message={msg} />}
            </div>
          </div>
        ))}
      </div>

      {/* Nachrichten-Eingabe */}
      {/* Übergibt die angepasste handleSendMessage-Funktion, die nur den Inhalt benötigt */}
      {/* Deaktiviert, wenn der Socket nicht verbunden ist */}
      <MessageInput onSendMessage={handleSendMessage} disabled={!isConnected} onTyping={onTyping ? handleTyping : undefined} />
    </div>
  );
};

export default ChatWindow;
