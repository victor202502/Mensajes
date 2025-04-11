// frontend/src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import LoginForm from './components/LoginForm'; // Stelle sicher, dass die Texte hier auch übersetzt sind
import RegisterForm from './components/RegisterForm'; // Stelle sicher, dass die Texte hier auch übersetzt sind
import UserList from './components/UserList'; // Übersetze Texte hier bei Bedarf
import ChatWindow from './components/ChatWindow'; // Übersetze Texte hier bei Bedarf
// import './App.css';

// Configuración de URLs
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const SOCKET_URL = API_URL;

function App() {
  // --- Estados del Componente ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState(''); // Dieser Fehler kommt von LoginForm/RegisterForm oder Backend

  // Estados específicos del Chat
  const [usersList, setUsersList] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [allMessages, setAllMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  // <<< CAMBIO: Estado inicial traducido >>>
  const [socketStatusMessage, setSocketStatusMessage] = useState('Getrennt.');
  const socketRef = useRef(null);

  // --- Función de Logout (Memoizada con useCallback) ---
  const handleLogout = useCallback(() => {
    console.log("App: Realizando logout...");
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setUsersList([]);
    setSelectedChatUser(null);
    setAllMessages([]);
    setFilteredMessages([]);
    setIsConnected(false);
    // <<< CAMBIO: Estado traducido >>>
    setSocketStatusMessage('Getrennt.');
    setAuthError('');
  }, []);

  // --- Efecto para Restaurar Sesión al Cargar ---
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("App: Benutzer aus localStorage wiederhergestellt:", parsedUser.username); // Log geändert
      } catch (e) {
        console.error("App: Fehler beim Parsen des Benutzers aus localStorage, Bereinigung...", e); // Log geändert
        handleLogout();
      }
    }
  }, [handleLogout]);

  // --- Función para Obtener Usuarios (Memoizada con useCallback) ---
  const fetchUsers = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log("App: Benutzerliste wird angefordert..."); // Log geändert
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setUsersList(response.data || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Benutzerliste:", error.response?.data?.message || error.message); // Log geändert
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage("Fehler beim Laden der Benutzer.");
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // --- Función para Obtener Mensajes (Memoizada con useCallback) ---
  const fetchMessages = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
     console.log("App: Nachrichtenverlauf wird angefordert..."); // Log geändert
     try {
        const response = await axios.get(`${API_URL}/api/messages`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        setAllMessages(response.data || []);
     } catch (error) {
        console.error("App: Fehler beim Laden des Verlaufs:", error.response?.data?.message || error.message); // Log geändert
         // <<< CAMBIO: Estado traducido >>>
        setSocketStatusMessage("Fehler beim Laden des Verlaufs.");
         if (error.response?.status === 401) handleLogout();
     }
  }, [handleLogout]);

  // --- Efecto Principal para Gestionar el Socket ---
  useEffect(() => {
    if (user && token) {
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage('Verbinde...');
      if (socketRef.current) socketRef.current.disconnect();
      const socket = io(SOCKET_URL, { auth: { token }, forceNew: true, reconnectionAttempts: 3, timeout: 10000 });
      socketRef.current = socket;

      const handleConnect = () => {
        console.log('App: Socket verbunden! ID:', socket.id); // Log geändert
        setIsConnected(true);
        // <<< CAMBIO: Estado traducido >>>
        setSocketStatusMessage('Verbunden.');
        fetchUsers();
        fetchMessages();
      };
      const handleDisconnect = (reason) => {
        console.log('App: Socket getrennt:', reason); // Log geändert
        setIsConnected(false);
        socketRef.current = null;
        if (reason === 'io server disconnect') {
           // <<< CAMBIO: Estado traducido >>>
           setSocketStatusMessage('Server-Trennung (Token ungültig/abgelaufen?).');
           handleLogout();
        } else if (reason === 'io client disconnect') {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage('Getrennt.');
        } else {
           // <<< CAMBIO: Estado traducido (teilweise) >>>
           setSocketStatusMessage(`Getrennt: ${reason}.`); // Grund bleibt Englisch
        }
      };
      const handleConnectError = (err) => {
        console.error('App: Socket-Verbindungsfehler:', err.message); // Log geändert
        setIsConnected(false);
        socketRef.current = null;
        if (err.message.includes("Authentication error")) {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage("Authentifizierungsfehler. Bitte erneut anmelden.");
            handleLogout();
        } else {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage("Netzwerk-/Serverfehler beim Verbinden.");
        }
      };
      const handleNewMessage = (incomingMessage) => {
        setAllMessages((prev) => [...prev, incomingMessage]);
      };
      const handleMessageError = (errorData) => {
        console.warn("App: Nachrichtenfehler empfangen:", errorData.error); // Log geändert
        const currentSocket = socketRef.current;
        // <<< CAMBIO: Estado traducido >>>
        const statusAfterTimeout = currentSocket?.connected ? 'Verbunden.' : 'Getrennt.';
        // <<< CAMBIO: Estado traducido (teilweise) >>>
        // Es ist besser, den Fehler vom Backend nicht direkt zu übersetzen
        setSocketStatusMessage(`Fehler: ${errorData.error}`);
        setTimeout(() => setSocketStatusMessage(statusAfterTimeout), 3000);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);
      socket.on('newMessage', handleNewMessage);
      socket.on('messageError', handleMessageError);

      return () => {
        console.log("App: Socket-Effekt wird bereinigt..."); // Log geändert
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off('newMessage', handleNewMessage);
        socket.off('messageError', handleMessageError);
        if (socket.connected) socket.disconnect();
        socketRef.current = null;
      };
    } else {
       if (socketRef.current) {
          console.log("App: Restlicher Socket wird getrennt, da kein Benutzer/Token vorhanden."); // Log geändert
          socketRef.current.disconnect();
          socketRef.current = null;
       }
      setIsConnected(false);
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage('Getrennt.');
    }
  }, [user, token, handleLogout, fetchUsers, fetchMessages]);

  // --- Efecto para Filtrar Mensajes (Sin cambios) ---
  useEffect(() => {
    if (!selectedChatUser || !user) {
      setFilteredMessages([]);
      return;
    }
    const filtered = allMessages.filter(msg =>
      (msg.sender.id === user.id && msg.recipient?.id === selectedChatUser.id) ||
      (msg.sender.id === selectedChatUser.id && msg.recipient?.id === user.id)
    );
    setFilteredMessages(filtered);
  }, [selectedChatUser, allMessages, user]);

  // --- Manejadores de Interacción ---
  const handleSelectUser = (userToChat) => {
    if (selectedChatUser?.id !== userToChat.id) {
        setSelectedChatUser(userToChat);
    }
  };
  const handleSendMessage = ({ recipientUsername, content }) => {
    const currentSocket = socketRef.current;
    if (currentSocket?.connected && content && recipientUsername) {
       currentSocket.emit('sendMessage', { recipientUsername, content });
       // <<< CAMBIO: Estado traducido >>>
       const statusAfterTimeout = currentSocket.connected ? 'Verbunden.' : 'Getrennt.';
       // <<< CAMBIO: Estado traducido >>>
       setSocketStatusMessage('Sende Nachricht...');
       setTimeout(() => setSocketStatusMessage(statusAfterTimeout), 1500);
    } else {
       console.warn("App: Senden nicht möglich.", { isConnected: currentSocket?.connected }); // Log geändert
       // <<< CAMBIO: Estado traducido >>>
       setSocketStatusMessage("Fehler: Nicht verbunden oder Daten fehlen.");
    }
  };

  // --- Manejadores de Autenticación ---
  const handleLoginSuccess = ({ token: newToken, user: loggedInUser }) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setToken(newToken);
    setUser(loggedInUser);
    setAuthError('');
    setIsRegistering(false);
  };
  const handleRegisterSuccess = (message) => {
    setAuthError('');
    setIsRegistering(false);
     // <<< CAMBIO: Alert traducido (teilweise) >>>
     // Der 'message' Teil kommt vom Backend und wird nicht übersetzt
    alert(message + " Bitte melden Sie sich an.");
  };
  const handleAuthFailure = (message) => {
    setAuthError(message); // Zeigt Fehler von LoginForm/RegisterForm an
  };

  // --- Renderizado Condicional ---

  // 1. Vista de Autenticación
  if (!user || !token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', backgroundColor: '#f4f7f6' }}>
        <div className="auth-container">
           {/* <<< CAMBIO: Título traducido >>> */}
          <h2>{isRegistering ? 'Registrierung' : 'Anmelden'}</h2>
          {authError && <p style={{ color: 'red' }}>{authError}</p>}
          {isRegistering ? (
            <RegisterForm onRegisterSuccess={handleRegisterSuccess} onAuthFailure={handleAuthFailure} />
          ) : (
            <LoginForm onLoginSuccess={handleLoginSuccess} onAuthFailure={handleAuthFailure} />
          )}
           {/* <<< CAMBIO: Botón traducido >>> */}
          <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center' }}>
            {isRegistering ? 'Schon ein Konto? Anmelden' : 'Kein Konto? Registrieren'}
          </button>
        </div>
      </div>
    );
  }

  // 2. Vista Principal del Chat
  return (
    <div className="app-container">
      <UserList
         users={usersList}
         onSelectUser={handleSelectUser}
         selectedUserId={selectedChatUser?.id}
      />
      <div className="chat-area" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #eee' }}>
         <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
             {/* <<< CAMBIO: Texto traducido >>> */}
             <span>Angemeldet als: <strong>{user.username}</strong></span>
             {/* <<< CAMBIO: Botón traducido >>> */}
             <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.9em' }}>Abmelden</button>
         </div>
         <ChatWindow
           currentUser={user}
           chatPartner={selectedChatUser}
           messages={filteredMessages}
           onSendMessage={handleSendMessage}
           statusMessage={socketStatusMessage} // Übergibt die (ggf. übersetzte) Statusnachricht
           isConnected={isConnected}
         />
      </div>

      {/* Bloque de Estilos Globales (sin cambios funcionales) */}
      <style jsx global>{`
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; color: #333; }
        ul { list-style: none; padding: 0; margin: 0; }
        button { cursor: pointer; }
        .auth-container { background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 30px 40px; border-radius: 8px; max-width: 400px; width: 90%; text-align: center; }
        .app-container { background: white; display: flex; height: 100vh; width: 100%; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; }
        .auth-container label { display: block; margin-bottom: 5px; text-align: left; font-weight: bold; font-size: 0.9em; }
        .auth-container input[type="text"],
        .auth-container input[type="password"] { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .auth-container button[type="submit"] { background-color: #007bff; color: white; padding: 10px 15px; border: none; border-radius: 4px; width: 100%; font-size: 1em; margin-top: 10px; }
        .auth-container button[type="submit"]:hover { background-color: #0056b3; }
      `}</style>
    </div>
  );
}

export default App;