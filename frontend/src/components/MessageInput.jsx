// frontend/src/components/MessageInput.jsx
import React, { useState, useRef } from 'react';
import { FiSend } from 'react-icons/fi';
import './MessageInput.css';

// Recibe onSendMessage que ahora solo espera el contenido, y disabled
// NEU (Phase 3): onTyping ist optional — wird beim Tippen aufgerufen,
// lokal gedrosselt (max. alle 2s), damit nicht bei jedem Tastendruck
// ein Socket-Event verschickt wird.
const MessageInput = ({ onSendMessage, disabled, onTyping }) => {
  const [message, setMessage] = useState('');
  const lastTypingEmitRef = useRef(0);

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 2000) {
        lastTypingEmitRef.current = now;
        onTyping();
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const content = message.trim();
    if (content && !disabled) {
      onSendMessage(content); // Solo pasa el contenido
      setMessage(''); // Limpia el input
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input">
      <input
        type="text"
        value={message}
        onChange={handleChange}
        placeholder="Escribe un mensaje..."
        disabled={disabled}
        className="message-input-field"
        aria-label="Mensaje"
      />
      <button type="submit" disabled={disabled || message.trim() === ''} className="message-input-send">
        <FiSend />
      </button>
    </form>
  );
};

export default MessageInput;
