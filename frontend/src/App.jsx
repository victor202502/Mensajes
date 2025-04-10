// frontend/src/App.jsx
import React, { useState, useEffect } from 'react'; // Importa useState y useEffect
import './App.css'; // Estilos básicos

// Importamos todos los componentes necesarios
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
// import Welcome from './components/Welcome'; // Ya no lo usamos directamente aquí
import ChatWindow from './components/ChatWindow'; // Importa el componente de chat

// --- (Opcional) Helper para decodificar JWT (si necesitas leer el payload) ---
// Puedes usar una librería como jwt-decode: npm install jwt-decode
// import { jwtDecode } from 'jwt-decode';

function App() {
  // --- ESTADO DE AUTENTICACIÓN ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // --- (Opcional) Estado para indicar si la verificación inicial está completa ---
  const [authChecked, setAuthChecked] = useState(false); // Para evitar parpadeo inicial

  // --- Efecto para verificar token al cargar la aplicación ---
  useEffect(() => {
    console.log("Verificando token existente al cargar App...");
    const token = localStorage.getItem('authToken');
    const storedUserString = localStorage.getItem('currentUser'); // Recupera el usuario guardado

    if (token && storedUserString) { // Verifica ambos
      console.log("Token y datos de usuario encontrados en localStorage.");
      try {
        // TODO (Avanzado): Validar el token aquí (expiración, firma si es posible)
        // Por ahora, confiamos en que si existen, son válidos (simplificación)
        const storedUser = JSON.parse(storedUserString); // Parsea el usuario guardado
        if (storedUser && storedUser.username) {
            console.log("Restaurando sesión basada en token y usuario almacenado.");
            setCurrentUser(storedUser); // Restaura el usuario en el estado
            setIsAuthenticated(true);   // Marca como autenticado
        } else {
            console.warn("Datos de usuario almacenados inválidos, limpiando.");
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }

      } catch (error) {
        console.error("Error al procesar datos almacenados:", error);
        // Limpia si hay error al parsear o validar
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
      }
    } else {
      console.log("No se encontró token y/o datos de usuario en localStorage.");
      // Asegura que el estado esté limpio si falta algo
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('authToken'); // Limpia por si solo quedó uno
      localStorage.removeItem('currentUser');
    }
    setAuthChecked(true); // Indica que la verificación inicial ha terminado
  }, []); // El array vacío [] significa que este efecto se ejecuta solo una vez al montar

  // --- MANEJADORES DE EVENTOS DE AUTENTICACIÓN ---

  // Se ejecuta cuando el login es exitoso (recibe usuario y token de LoginForm)
  const handleLoginSuccess = (userData, token) => {
    if (!userData || !userData.username || !token) {
      console.error("handleLoginSuccess recibió datos inválidos (usuario o token):", userData, token);
      return;
    }
    console.log("Login exitoso en App.jsx:", { user: userData, token: /* token */ '(oculto)' }); // Oculta token del log
    setIsAuthenticated(true);
    setCurrentUser(userData);

    // Guarda token y usuario en localStorage
    try {
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(userData)); // Guarda como string
        console.log("Token y datos de usuario guardados en localStorage.");
    } catch (e) {
        console.error("Error guardando en localStorage:", e);
    }
  };

  // Se ejecuta al pulsar el botón Logout (pasado a ChatWindow o donde esté el botón)
  const handleLogout = () => {
    console.log("Logout solicitado en App.jsx");
    setIsAuthenticated(false);
    setCurrentUser(null);

    // Elimina token y usuario de localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    console.log("Token y datos de usuario eliminados de localStorage.");
  };
  // -------------------------------------------

  // --- RENDERIZADO DEL COMPONENTE ---

  // Muestra un mensaje de carga mientras se verifica el token inicial
  if (!authChecked) {
    return <div className="loading-auth">Verificando sesión...</div>;
  }

  return (
    <div className="App">
      <header>
        <h1>Mi Aplicación de Mensajería</h1>
        {/* Muestra info del usuario y botón Logout si está autenticado */}
        {isAuthenticated && currentUser ? (
             <div className="user-info">
                 <span>Bienvenido, {currentUser.username}!</span>
                 <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
             </div>
        ) : (
             <p>Por favor, regístrate o accede.</p> // Muestra si no está autenticado
        )}
      </header>

      <main className="content-container">
        {!isAuthenticated ? (
          // --- VISTA NO AUTENTICADA ---
          <div className="auth-forms"> {/* Contenedor para formularios */}
            <section className="auth-section">
              <RegisterForm />
            </section>
            <section className="auth-section">
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </section>
          </div>
        ) : (
          // --- VISTA AUTENTICADA ---
          <section className="main-app-section">
            {/* Renderiza ChatWindow pasando el usuario actual */}
            {currentUser && <ChatWindow user={currentUser} />}
          </section>
        )}
      </main>

       {/* Puedes añadir un footer si quieres */}
       {/*
       <footer className="app-footer">
         <p>© 2024 Mi App de Mensajes</p>
       </footer>
       */}
    </div>
  );
}

export default App;