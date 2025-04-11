// frontend/src/components/ChatWindow.jsx
import React, { useEffect, useRef } from 'react';
import MessageInput from './MessageInput'; // Stelle sicher, dass die Texte hier auch übersetzt sind

// --- Komponente ChatWindow (Modifiziert) ---
// Erhält alles als Props von App.jsx:
// - currentUser: Das Objekt des angemeldeten Benutzers { id, username, ... }
// - chatPartner: Das Objekt des Benutzers, mit dem gechattet wird { id, username } oder null
// - messages: Array der GEFILTERTEN Nachrichten für dieses spezifische Gespräch
// - onSendMessage: Callback-Funktion zum Senden einer Nachricht (in App.jsx definiert)
// - statusMessage: Statusnachricht des Sockets (z. B. "Verbunden.", "Fehler...")
// - isConnected: Boolean, der den Verbindungsstatus des Sockets anzeigt

const ChatWindow = ({ currentUser, chatPartner, messages, onSendMessage, statusMessage, isConnected }) => {
  // Referenz für das automatische Scrollen der Nachrichtenliste
  const messageListRef = useRef(null);

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

  // --- Funktion zum Behandeln des Nachrichtenversands ---
  const handleSendMessage = (content) => {
     if (chatPartner && content) {
        console.log(`ChatWindow: Nachricht für ${chatPartner.username} wird an App.jsx übergeben`); // Log geändert
        onSendMessage({ recipientUsername: chatPartner.username, content });
     } else {
        console.warn("ChatWindow: Versuch, Nachricht ohne chatPartner oder Inhalt zu senden."); // Log geändert
     }
  };

  // --- Bedingtes Rendern, wenn kein Benutzer ausgewählt ist ---
  if (!chatPartner) {
    return (
      <div
        className="chat-window-placeholder"
        style={{
          flexGrow: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
          height: 'calc(100vh - 150px)', textAlign: 'center', color: '#777',
          backgroundColor: '#f8f9fa'
        }}
      >
        {/* <<< CAMBIO: Texte übersetzt >>> */}
        <h2>Willkommen, {currentUser?.username}!</h2>
        <p style={{ marginTop: '10px' }}>Wähle einen Benutzer aus der Liste links, um mit dem Chatten zu beginnen.</p>
        <p style={{ marginTop: '20px', fontSize: '0.9em', color: isConnected ? 'green' : 'red' }}>
            {/* Zeigt den Status (der bereits in App.jsx übersetzt sein sollte) */}
             {statusMessage} {isConnected ? '(Verbunden)' : '(Getrennt)'}
         </p>
      </div>
    );
  }

  // --- Haupt-Rendering, wenn ein Benutzer ausgewählt ist ---
  return (
    <div className="chat-window" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '10px', height: 'calc(100vh - 100px)', borderLeft: '1px solid #eee' }}>
      {/* Chat-Header */}
      <div style={{ paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
         {/* <<< CAMBIO: Text übersetzt >>> */}
         <h3>Chat mit: <strong>{chatPartner.username}</strong></h3>
         <p style={{ fontSize: '0.8em', color: isConnected ? 'green' : 'red', margin: '5px 0 0 0' }}>
             {/* Zeigt den Status (der bereits in App.jsx übersetzt sein sollte) */}
             {statusMessage} {isConnected ? '(Verbunden)' : '(Getrennt)'}
         </p>
      </div>

      {/* Nachrichtenliste */}
      <div
        ref={messageListRef}
        className="message-list"
        style={{
           flexGrow: 1, border: '1px solid #ccc', marginBottom: '10px',
           overflowY: 'auto', padding: '10px', display: 'flex',
           flexDirection: 'column', backgroundColor: '#f9f9f9'
        }}
      >
        {/* Nachricht, wenn das Gespräch leer ist */}
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
            {/* <<< CAMBIO: Text übersetzt >>> */}
            <i>Keine Nachrichten in diesem Gespräch. Sende die erste!</i>
          </p>
        )}

        {/* Mapping der als Prop empfangenen Nachrichten */}
        {messages.map((msg) => (
          <div
            key={msg.id || `temp-${msg.sender.id}-${msg.content.substring(0, 5)}-${Date.now()}`}
            style={{
              alignSelf: msg.sender.id === currentUser.id ? 'flex-end' : 'flex-start',
              backgroundColor: msg.sender.id === currentUser.id ? '#dcf8c6' : '#ffffff',
              border: msg.sender.id !== currentUser.id ? '1px solid #eee' : 'none',
              borderRadius: '10px', padding: '8px 12px', margin: '5px',
              maxWidth: '75%', wordWrap: 'break-word', boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
            }}
          >
            {/* Inhalt der Nachricht */}
            <div style={{ marginTop: msg.sender.id === currentUser.id ? '0' : '3px' }}>{msg.content}</div>
            {/* Zeitstempel */}
            <div style={{ fontSize: '0.7em', color: '#aaa', textAlign: 'right', marginTop: '4px' }}>
              {/* <<< CAMBIO: Text übersetzt >>> */}
              {/* Zeigt 'Senden...' wenn createdAt noch nicht vorhanden ist */}
              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'}
            </div>
          </div>
        ))}
      </div>

      {/* Nachrichten-Eingabe */}
      {/* Übergibt die angepasste handleSendMessage-Funktion, die nur den Inhalt benötigt */}
      {/* Deaktiviert, wenn der Socket nicht verbunden ist */}
      <MessageInput onSendMessage={handleSendMessage} disabled={!isConnected} />
    </div>
  );
};

export default ChatWindow;