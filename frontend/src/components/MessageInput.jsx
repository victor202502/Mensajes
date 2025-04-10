// frontend/src/components/MessageInput.jsx
import React, { useState } from 'react';

// Recibe onSendMessage y disabled del padre (ChatWindow)
const MessageInput = ({ onSendMessage, disabled }) => {
  // Estado para manejar ambos campos del formulario
  const [messageData, setMessageData] = useState({
    recipient: '',
    content: ''
  });
  // Estado para errores de validación del input
  const [inputError, setInputError] = useState('');

  // Manejador de cambios genérico para ambos inputs
  const handleChange = (e) => {
    setMessageData({
      ...messageData,
      [e.target.name]: e.target.value // Actualiza 'recipient' o 'content'
    });
    setInputError(''); // Limpia el error al escribir
  };

  // Manejador del envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault(); // Evita recargar
    const recipientToSend = messageData.recipient.trim();
    const contentToSend = messageData.content.trim();

    // Validaciones simples en el frontend
    if (!recipientToSend) {
        setInputError('Por favor, ingresa un destinatario.');
        return; // No envía
    }
    if (!contentToSend) {
        setInputError('El mensaje no puede estar vacío.');
        return; // No envía
    }

    // Llama a la función del padre con el objeto { recipientUsername, content }
    onSendMessage({ recipientUsername: recipientToSend, content: contentToSend });

    // Limpia SÓLO el campo de contenido, mantiene el destinatario
    setMessageData({ ...messageData, content: '' });
    setInputError(''); // Limpia el error si se envió
  };

  return (
    // noValidate previene validación HTML nativa, preferimos la nuestra
    <form onSubmit={handleSubmit} className="message-input-form" noValidate>
      {/* Input para Destinatario */}
      <div className="input-group" style={{ marginBottom: '10px' }}>
        <label htmlFor="recipient-input" style={{ marginRight: '5px', display: 'inline-block', width: '50px' }}>Para:</label>
        <input
          type="text"
          id="recipient-input"
          name="recipient" // Corresponde a la clave en messageData
          placeholder="Usuario Destino"
          value={messageData.recipient}
          onChange={handleChange}
          disabled={disabled} // Deshabilita si el socket no está conectado
          required // Validación básica HTML
          aria-describedby={inputError ? "input-error" : undefined}
        />
      </div>
      {/* Input para Mensaje y Botón */}
      <div className="input-group" style={{ display: 'flex' }}>
        <label htmlFor="content-input" style={{ marginRight: '5px', display: 'inline-block', width: '50px' }}>Msj:</label>
        <input
          type="text"
          id="content-input"
          name="content" // Corresponde a la clave en messageData
          placeholder="Escribe tu mensaje aquí..."
          value={messageData.content}
          onChange={handleChange}
          disabled={disabled}
          maxLength={500} // Límite opcional
          required
          style={{ flexGrow: 1 }} // Ocupa el espacio restante
          aria-describedby={inputError ? "input-error" : undefined}
        />
        {/* Botón de Enviar */}
        <button
          type="submit"
          disabled={disabled || !messageData.content.trim() || !messageData.recipient.trim()} // Deshabilitado si no hay conexión, contenido o destinatario
          style={{ marginLeft: '10px' }}
        >
          Enviar
        </button>
      </div>
      {/* Muestra errores de validación local */}
      {inputError && <p id="input-error" style={{ color: 'orange', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>{inputError}</p>}
    </form>
  );
};

export default MessageInput;