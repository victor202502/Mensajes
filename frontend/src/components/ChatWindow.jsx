// frontend/src/components/ChatWindow.jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import MessageInput from './MessageInput';
import axios from 'axios'; // Necesario para historial
// import MessageList from './MessageList'; // Descomentar cuando lo crees

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const ChatWindow = ({ user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const [socketStatusMessage, setSocketStatusMessage] = useState('Conectando...');
  const [messages, setMessages] = useState([]);
  // Referencia al div de la lista de mensajes para auto-scroll
  const messageListRef = useRef(null);

  // --- Función para hacer scroll al fondo ---
  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  // --- Efecto para Conexión/Desconexión del Socket ---
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token || !user) {
      const errorMsg = !token ? "No autenticado." : "Faltan datos de usuario.";
      setSocketStatusMessage(`Error: ${errorMsg} No se puede conectar.`);
      console.error("ChatWindow: No token o user data.");
      return;
    }

    console.log(`ChatWindow: Conectando socket a ${SOCKET_URL} para ${user.username}`);
    setSocketStatusMessage('Conectando...');

    socketRef.current = io(SOCKET_URL, {
      auth: { token }, forceNew: true, reconnectionAttempts: 3, timeout: 10000,
    });
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('ChatWindow: Socket conectado! ID:', socket.id);
      setIsConnected(true);
      setSocketStatusMessage('Conectado.');
    });

    socket.on('disconnect', (reason) => {
      console.log('ChatWindow: Socket desconectado:', reason);
      setIsConnected(false);
      setSocketStatusMessage(`Desconectado: ${reason}.`);
    });

    socket.on('connect_error', (err) => {
      console.error('ChatWindow: Error de conexión Socket:', err.message);
      setIsConnected(false);
      let errorMsg = `Error de conexión: ${err.message}`;
      if (err.message.includes("token")) { errorMsg = "Error de autenticación."; }
      else { errorMsg = "Error de red al conectar."; }
      setSocketStatusMessage(errorMsg);
    });

    // Escuchar nuevos mensajes
    socket.on('newMessage', (incomingMessage) => {
      console.log('ChatWindow: Nuevo mensaje:', incomingMessage);
      setMessages((prevMessages) => [...prevMessages, incomingMessage]);
      // Scroll al fondo después de añadir el mensaje (con un pequeño delay)
      setTimeout(scrollToBottom, 50);
    });

    // Escuchar errores de envío de mensajes
    socket.on('messageError', (errorData) => {
      console.warn("ChatWindow: Error de mensaje recibido:", errorData.error);
      setSocketStatusMessage(`Error: ${errorData.error}`);
      setTimeout(() => setSocketStatusMessage(isConnected ? 'Conectado.' : 'Desconectado.'), 3000);
    });

    // Limpieza al desmontar
    return () => {
      if (socketRef.current) {
        console.log("ChatWindow: Desconectando socket...");
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [user]); // Depende de user por si cambia

  // --- Efecto para Cargar Historial ---
  useEffect(() => {
     const fetchMessages = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        console.log("ChatWindow: Solicitando historial...");
        setSocketStatusMessage("Cargando historial...");
        try {
           // TODO: Proteger esta ruta en el backend con authMiddleware
           const response = await axios.get(`${SOCKET_URL}/api/messages`, {
             headers: { Authorization: `Bearer ${token}` }
           });
           console.log("ChatWindow: Historial recibido (" + response.data?.length + " mensajes)");
           setMessages(response.data || []);
           setSocketStatusMessage("Conectado."); // O dejar el estado de conexión
           // Scroll al fondo después de cargar el historial
           setTimeout(scrollToBottom, 100);
        } catch (error) {
           console.error("ChatWindow: Error al cargar historial:", error.response?.data?.message || error.message);
           setSocketStatusMessage("Error al cargar historial.");
        }
     };

     // Solo carga si el socket se conectó exitosamente
     if (isConnected) {
        fetchMessages();
     }
  }, [isConnected]); // Se ejecuta cuando 'isConnected' cambia (ej. al conectar)

  // --- Función para Enviar Mensajes ---
  const handleSendMessage = ({ recipientUsername, content }) => {
    if (socketRef.current && isConnected && content && recipientUsername) {
       console.log(`ChatWindow: Emitiendo 'sendMessage' para ${recipientUsername}: ${content}`);
       socketRef.current.emit('sendMessage', { recipientUsername, content });
       setSocketStatusMessage('Enviando...');
       setTimeout(() => setSocketStatusMessage(isConnected ? 'Conectado.' : 'Desconectado.'), 1500);
    } else {
       console.warn("ChatWindow: No se puede enviar.", { isConnected, content, recipientUsername });
       setSocketStatusMessage("No conectado, falta mensaje o destinatario.");
    }
  };

  return (
    <div className="chat-window">
      <h3>Chat</h3>
      <p>Usuario: <strong>{user?.username || 'N/A'}</strong> <span style={{ color: isConnected ? 'green' : 'red', fontSize: '0.8em' }}>({isConnected ? 'Online' : 'Offline'})</span></p>

      {/* Lista de Mensajes */}
      <div
        ref={messageListRef} // Asigna la referencia para el scroll
        className="message-list"
        style={{ height: '400px', border: '1px solid #ccc', marginBottom: '10px', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column' }}
      >
        {messages.length === 0 && !isConnected && <p><i>Conectando...</i></p>}
        {messages.length === 0 && isConnected && <p><i>No hay mensajes. ¡Envía uno!</i></p>}
        {messages.map((msg) => (
          // Renderiza cada mensaje (Idealmente componente MessageItem)
          <div
            key={msg.id}
            style={{
                alignSelf: msg.sender.id === user.id ? 'flex-end' : 'flex-start', // Alinea mensajes
                backgroundColor: msg.sender.id === user.id ? '#dcf8c6' : '#fff', // Colores diferentes
                borderRadius: '10px',
                padding: '8px 12px',
                margin: '5px',
                maxWidth: '70%',
                wordWrap: 'break-word'
             }}
          >
             <strong style={{ color: msg.sender.id === user.id ? '#075e54' : '#4a90e2' }}>{msg.sender.username}:</strong> {/* Muestra remitente */}
             <div style={{ marginTop: '3px' }}>{msg.content}</div>
             <div style={{ fontSize: '0.7em', color: '#aaa', textAlign: 'right', marginTop: '4px' }}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {/* Muestra destinatario si no soy yo */}
                {msg.recipient && msg.recipient.id !== user.id && ` (para ${msg.recipient.username})`}
             </div>
          </div>
        ))}
         {/* Muestra estado/error del socket */}
         <p style={{ color: '#aaa', fontSize: '0.8em', textAlign: 'center', marginTop: 'auto' }}>[{socketStatusMessage}]</p>
      </div>

      {/* Input de Mensajes */}
      <MessageInput onSendMessage={handleSendMessage} disabled={!isConnected} />
    </div>
  );
};

export default ChatWindow;