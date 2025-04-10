// frontend/src/App.jsx
import React, { useState } from 'react'; // Necesitamos useState para manejar el estado
import './App.css'; // Estilos básicos

// Importamos todos los componentes necesarios
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import Welcome from './components/Welcome.jsx'; // Asegúrate de haber creado este componente

function App() {
  // --- ESTADO DE AUTENTICACIÓN ---
  // 'isAuthenticated' controla si se muestra la bienvenida o los formularios
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // 'currentUser' almacena los datos del usuario logueado (recibidos del backend)
  const [currentUser, setCurrentUser] = useState(null);
  // -------------------------------

  // --- MANEJADORES DE EVENTOS DE AUTENTICACIÓN ---

  // Función que se pasa a LoginForm. Se ejecuta cuando el login es exitoso.
  // Recibe los datos del usuario desde la respuesta del backend.
  const handleLoginSuccess = (userData) => {
    if (!userData || !userData.username) {
      console.error("handleLoginSuccess recibió datos de usuario inválidos:", userData);
      // Podrías mostrar un error al usuario aquí si lo deseas
      return;
    }
    console.log("Login exitoso en App.jsx, datos recibidos:", userData);
    setIsAuthenticated(true); // Marca al usuario como autenticado
    setCurrentUser(userData); // Guarda la información del usuario
    // PRÓXIMO PASO: Guardar el token JWT en localStorage aquí
    // if (userData.token) { // Asumiendo que el backend envía un token
    //   localStorage.setItem('authToken', userData.token);
    // }
  };

  // Función que se pasa a Welcome. Se ejecuta al pulsar el botón Logout.
  const handleLogout = () => {
    console.log("Logout solicitado en App.jsx");
    setIsAuthenticated(false); // Marca al usuario como no autenticado
    setCurrentUser(null);      // Borra la información del usuario
    // PRÓXIMO PASO: Borrar el token JWT de localStorage aquí
    // localStorage.removeItem('authToken');
  };
  // -------------------------------------------

  // --- RENDERIZADO DEL COMPONENTE ---
  return (
    <div className="App">
      <header>
        <h1>Mi Aplicación</h1>
        {/* Solo muestra este párrafo si el usuario NO está autenticado */}
        {!isAuthenticated && <p>Por favor, regístrate o accede.</p>}
      </header>

      {/* Usamos un contenedor principal para el contenido */}
      <main className="content-container"> {/* Puedes darle el estilo que quieras */}

        {/* Renderizado Condicional: Muestra una cosa u otra según 'isAuthenticated' */}
        {!isAuthenticated ? (
          // --- VISTA NO AUTENTICADA ---
          // Usamos un Fragmento (<>) para agrupar los formularios sin añadir un div extra
          <>
            <section className="auth-section"> {/* Clase para estilo opcional */}
              <RegisterForm /> {/* El formulario de registro no necesita props especiales por ahora */}
            </section>
            <section className="auth-section"> {/* Clase para estilo opcional */}
              {/* Pasamos la función handleLoginSuccess al LoginForm */}
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </section>
          </>
        ) : (
          // --- VISTA AUTENTICADA ---
          <section className="welcome-section"> {/* Clase para estilo opcional */}
            {/* Pasamos los datos del usuario actual y la función de logout al componente Welcome */}
            {/* Nos aseguramos de que currentUser no sea null antes de renderizar Welcome */}
            {currentUser && <Welcome user={currentUser} onLogout={handleLogout} />}
          </section>
        )}
        {/* --- Fin Renderizado Condicional --- */}

      </main>

      {/* Puedes añadir un footer si quieres */}
      {/*
      <footer>
        <p>© 2024 Mi Aplicación</p>
      </footer>
      */}
    </div>
  );
}

export default App;