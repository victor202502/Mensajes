// frontend/src/App.jsx
import React, { useState, useEffect } from 'react'; // Añadimos useEffect
import './App.css';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import Welcome from './components/Welcome';
// Importamos el nuevo componente de chat (cuando lo crees)
// import ChatWindow from './components/ChatWindow';

// --- (Opcional) Helper para decodificar JWT (si necesitas leer el payload) ---
// Puedes usar una librería como jwt-decode: npm install jwt-decode
// import { jwtDecode } from 'jwt-decode';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // --- (Opcional) Estado para indicar si la verificación inicial está completa ---
  const [authChecked, setAuthChecked] = useState(false);

  // --- Efecto para verificar token al cargar la aplicación ---
  useEffect(() => {
    console.log("Verificando token existente al cargar App...");
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log("Token encontrado en localStorage.");
      // TODO (Avanzado): Validar el token aquí.
      // Opciones:
      // 1. Decodificarlo y comprobar si ha expirado (requiere jwt-decode).
      // 2. Hacer una petición a una ruta protegida del backend (ej. /api/auth/verify)
      //    que simplemente devuelva éxito si el token es válido.
      // Por ahora, asumiremos que si existe, es válido (simplificación):
      try {
        // --- Ejemplo Simplificado (asume válido si existe) ---
        // En un caso real, necesitarías decodificar y validar la expiración
        // const decoded = jwtDecode(token);
        // if (decoded.exp * 1000 > Date.now()) { // Comprueba expiración
        //    console.log("Token parece válido (pendiente de validación real), restaurando sesión...");
        //    // Necesitarías obtener los datos del usuario de alguna forma
        //    // (quizás guardados junto al token o desde el payload decodificado)
        //    // setCurrentUser({ userId: decoded.userId, username: decoded.username }); // Ejemplo
        //    setIsAuthenticated(true);
        // } else {
        //    console.log("Token expirado, eliminando...");
        //    localStorage.removeItem('authToken');
        // }

        // --- Por ahora, solo restauramos si existe (NECESITA MEJORA) ---
        // ¡¡PELIGRO!! Esto no valida el token realmente.
        // Necesitas una forma de obtener los datos del usuario asociados al token.
        // Podrías guardarlos en localStorage junto al token o decodificarlos.
        // Asumamos que los guardaste (MAL EJEMPLO, pero para ilustrar):
         const storedUser = localStorage.getItem('currentUser');
         if(storedUser) {
            console.log("Restaurando sesión basada en token y usuario almacenado (simplificado)");
            setCurrentUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
         } else {
             console.log("Token encontrado pero no hay datos de usuario, limpiando.");
             localStorage.removeItem('authToken'); // Limpia si no hay datos de usuario
         }

      } catch (error) {
        console.error("Error al procesar token existente:", error);
        localStorage.removeItem('authToken'); // Limpia token inválido
      }
    } else {
      console.log("No se encontró token en localStorage.");
    }
    setAuthChecked(true); // Indica que la verificación inicial ha terminado
  }, []); // El array vacío [] significa que este efecto se ejecuta solo una vez al montar el componente

  // --- MANEJADORES DE EVENTOS DE AUTENTICACIÓN (Modificados) ---

  // Ahora acepta 'token' como segundo argumento
  const handleLoginSuccess = (userData, token) => {
    if (!userData || !userData.username || !token) { // Verifica también el token
      console.error("handleLoginSuccess recibió datos inválidos (usuario o token):", userData, token);
      return;
    }
    console.log("Login exitoso en App.jsx:", { user: userData, token });
    setIsAuthenticated(true);
    setCurrentUser(userData);

    // --- GUARDAR TOKEN Y USUARIO EN localStorage ---
    try {
        localStorage.setItem('authToken', token);
        // Guardamos también los datos del usuario para poder restaurarlos (simplificación)
        // En una app real, podrías solo guardar el token y obtener los datos del
        // usuario del payload del token o de una petición /api/profile al cargar.
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log("Token y datos de usuario guardados en localStorage.");
    } catch (e) {
        console.error("Error guardando en localStorage:", e);
        // Quizás el almacenamiento está lleno o deshabilitado
    }
  };

  // Modificado para eliminar token y usuario
  const handleLogout = () => {
    console.log("Logout solicitado en App.jsx");
    setIsAuthenticated(false);
    setCurrentUser(null);

    // --- ELIMINAR TOKEN Y USUARIO DE localStorage ---
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser'); // Elimina también los datos guardados
    console.log("Token y datos de usuario eliminados de localStorage.");
    // Opcional: redirigir o forzar recarga si es necesario
    // window.location.reload();
  };

  // --- RENDERIZADO DEL COMPONENTE ---

  // Opcional: Mostrar un indicador de carga mientras se verifica el token inicial
  if (!authChecked) {
    return <div>Verificando autenticación...</div>; // O un spinner, etc.
  }

  return (
    <div className="App">
      <header>
        <h1>Mi Aplicación de Mensajería</h1> {/* Título actualizado */}
        {!isAuthenticated && <p>Por favor, regístrate o accede.</p>}
      </header>

      <main className="content-container">
        {!isAuthenticated ? (
          // --- VISTA NO AUTENTICADA ---
          <>
            <section className="auth-section">
              <RegisterForm />
            </section>
            <section className="auth-section">
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </section>
          </>
        ) : (
          // --- VISTA AUTENTICADA ---
          <section className="main-app-section"> {/* Cambiado nombre de clase */}
            {/* Muestra un saludo y el botón de logout */}
            <div style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ccc' }}>
                {currentUser && <span>Bienvenido, {currentUser.username}! </span>}
                <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
            </div>

            {/* AQUÍ IRÁ EL COMPONENTE DE CHAT */}
            {currentUser && (
                <div>
                    <h2>Chat Principal</h2>
                    {/* <ChatWindow user={currentUser} /> */}
                    <p>(Aquí irá el componente ChatWindow...)</p>
                </div>
            )}

            {/* Eliminamos el componente Welcome original si ya no lo usamos directamente aquí */}
            {/* {currentUser && <Welcome user={currentUser} onLogout={handleLogout} />} */}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;