// frontend/src/components/Welcome.jsx
import React from 'react';

// Acepta 'user' y 'onLogout' como props
const Welcome = ({ user, onLogout }) => {

  // Manejador para el clic del botón de logout
  const handleLogoutClick = () => {
    // Llama a la función onLogout que viene de App.jsx
    onLogout();
  };

  return (
    <div>
      {/* Muestra el nombre de usuario.
          Añadimos una comprobación por si user llega a ser null inesperadamente */}
      <h2>¡Bienvenido, {user ? user.username : 'Usuario'}!</h2>
      <p>Has accedido correctamente.</p>
      {/* Botón de Logout */}
      <button onClick={handleLogoutClick}>
        Logout
      </button>
    </div>
  );
};

export default Welcome;