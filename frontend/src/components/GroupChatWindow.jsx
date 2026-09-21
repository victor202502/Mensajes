// frontend/src/components/GroupChatWindow.jsx
// NEU (Phase 4): eigenständige Chat-Ansicht für Gruppen, bewusst getrennt von
// ChatWindow.jsx (1:1). So bleibt der bestehende, geprüfte 1:1-Chat-Code
// komplett unangetastet — hier wird nichts wiederverwendet, was das Risiko
// für die bestehende Funktionalität erhöhen könnte.
import React, { useEffect, useRef } from 'react';
import { FiArrowLeft, FiInfo, FiUsers } from 'react-icons/fi';
import MessageInput from './MessageInput';
import Avatar from './Avatar';
import './ChatWindow.css'; // Wiederverwendung von Layout/Bubble/Menü-Styles (keine Duplizierung von CSS)
import './GroupChatWindow.css'; // nur die gruppenspezifischen Ergänzungen

const GroupChatWindow = ({
  currentUser,
  group,
  messages,
  onSendMessage,
  onlineMemberCount,
  onBackToList,
  onOpenInfo,
}) => {
  const messageListRef = useRef(null);

  const scrollToBottom = () => {
    if (messageListRef.current) {
      const lastMessage = messageListRef.current.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSendMessage = (content) => {
    if (group && content) {
      onSendMessage({ groupId: group.id, content });
    }
  };

  if (!group) return null;

  return (
    <div className="chat-window">
      <div className="chat-header">
        {onBackToList && (
          <button type="button" className="chat-back-btn" onClick={onBackToList} aria-label="Zurück zur Benutzerliste">
            <FiArrowLeft />
          </button>
        )}
        <Avatar name={group.name} emoji={group.avatarEmoji} size="md" />
        <div className="chat-header-info">
          <h3>{group.name}</h3>
          <p className="chat-partner-presence">
            <FiUsers className="group-member-count-icon" />
            {group.memberCount} {group.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
            {typeof onlineMemberCount === 'number' && onlineMemberCount > 0 && ` · ${onlineMemberCount} online`}
          </p>
        </div>
        <div className="chat-menu-wrapper">
          <button type="button" className="chat-menu-btn" onClick={onOpenInfo} aria-label="Gruppeninfo" title="Gruppeninfo">
            <FiInfo />
          </button>
        </div>
      </div>

      <div ref={messageListRef} className="message-list">
        {messages.length === 0 && (
          <p className="message-list-empty">
            <i>Noch keine Nachrichten in dieser Gruppe. Sende die erste!</i>
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender.id === currentUser.id;
          return (
            <div
              key={msg.id || `temp-${msg.sender.id}-${msg.content.substring(0, 5)}-${Date.now()}`}
              className={`message ${isOwn ? 'message-own' : 'message-received'}`}
            >
              {!isOwn && <div className="group-message-sender">{msg.sender.username}</div>}
              <div className="message-content">{msg.content}</div>
              <div className="message-time">
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'}
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput onSendMessage={handleSendMessage} disabled={false} />
    </div>
  );
};

export default GroupChatWindow;
