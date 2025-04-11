// frontend/src/components/MessageInput.jsx
import React, { useState } from 'react';

// Recibe onSendMessage que ahora solo espera el contenido, y disabled
const MessageInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const content = message.trim();
    if (content && !disabled) {
      onSendMessage(content); // Solo pasa el contenido
      setMessage(''); // Limpia el input
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input" style={{ display: 'flex', marginTop: '10px' }}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe un mensaje..."
        disabled={disabled}
        style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' }}
        aria-label="Mensaje"
      />
      <button type="submit" disabled={disabled || message.trim() === ''} style={{ padding: '10px 15px', border: '1px solid #007bff', backgroundColor: '#007bff', color: 'white', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
        Enviar
      </button>
    </form>
  );
};

export default MessageInput;