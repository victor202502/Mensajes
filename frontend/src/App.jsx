// frontend/src/App.jsx
import React, { useState } from 'react'; // useState ya no es necesario aquí si no lo usas directamente
// Se eliminan las importaciones por defecto de Vite (logo, contador)
import './App.css'; // Mantenemos los estilos básicos o los personalizamos

// Importamos los componentes de formulario que crearemos
import RegisterForm from './components/RegisterForm'; // <-- Forma recomendada
import LoginForm from './components/LoginForm';       // <-- Forma recomendada    // Asegúrate de crear este archivo

function App() {
  // Se elimina el estado 'count' que venía con la plantilla de Vite
  return (
    <div className="App"> {/* O simplemente <> </> si no necesitas la clase App */}
      <header> {/* Puedes añadir clases CSS si quieres */}
        <h1>Bienvenido a Mi Aplicación</h1>
        <p>Por favor, regístrate o accede.</p>
      </header>

      {/* Contenedor para los formularios */}
      <main className="form-container"> {/* Una clase para dar estilo */}
        <section>
          <RegisterForm />
        </section>
        <section>
          <LoginForm />
        </section>
      </main>
    </div>
  );
}

export default App;
