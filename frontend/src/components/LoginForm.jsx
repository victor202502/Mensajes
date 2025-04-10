// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

// --- ACEPTA LA PROP onLoginSuccess ---
// Usamos desestructuración de props ({ onLoginSuccess }) para obtenerla directamente
const LoginForm = ({ onLoginSuccess }) => {
  // El estado sigue siendo para username y password
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  // Mantenemos un estado para mensajes de *error* en este componente
  const [errorMessage, setErrorMessage] = useState('');

  // Manejador de cambios en los inputs (sin cambios)
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Manejador del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Previene recarga de página
    setErrorMessage(''); // Limpia errores anteriores al intentar de nuevo
    console.log('Datos a enviar (Login):', formData);

    try {
      const apiUrl = 'http://localhost:5001/api/auth/login';
      // Hacemos la petición POST al backend con username y password
      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor (Login):', response.data);

      // --- LÓGICA DE ÉXITO ---
      // Verificamos si la respuesta contiene los datos del usuario esperados
      if (response.data && response.data.user && response.data.user.username) {
        // SI TODO OK: Llama a la función onLoginSuccess pasada desde App.jsx
        // y le enviamos los datos del usuario (y el token, si lo hubiera)
        onLoginSuccess(response.data.user /*, response.data.token */); // Descomenta token cuando lo implementes

        // Ya no necesitamos limpiar el formulario aquí ni mostrar mensaje de éxito,
        // porque App.jsx se encargará de cambiar la vista.
        // setFormData({ username: '', password: '' }); // Opcional

      } else {
        // Si la respuesta del backend (aún siendo exitosa 2xx) no tiene los datos esperados
        console.error("Login exitoso (2xx) pero faltan datos del usuario en la respuesta:", response.data);
        setErrorMessage("Ocurrió un problema al cargar tu sesión. Intenta de nuevo.");
      }
      // ------------------------

    } catch (error) {
      // --- LÓGICA DE ERROR ---
      console.error('Error en el login:', error);
      // Muestra el mensaje de error específico del backend si está disponible,
      // o uno genérico si no.
      setErrorMessage(error.response?.data?.message || 'Error en el acceso. Verifica tus credenciales o inténtalo más tarde.');
      // ------------------------
    }
  };

  // --- RENDERIZADO DEL COMPONENTE ---
  return (
    <div>
      <h2>Acceder</h2>
      <form onSubmit={handleSubmit}>
        {/* Input para Username (sin cambios respecto a la versión anterior con username) */}
        <div>
          <label htmlFor="login-username">Usuario:</label>
          <input
            type="text"
            id="login-username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            aria-describedby={errorMessage ? "login-error-message" : undefined} // Para accesibilidad
          />
        </div>
        {/* Input para Contraseña (sin cambios) */}
        <div>
          <label htmlFor="login-password">Contraseña:</label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            aria-describedby={errorMessage ? "login-error-message" : undefined} // Para accesibilidad
          />
        </div>
        <button type="submit">Acceder</button>
      </form>
      {/* Mostramos SÓLO los mensajes de ERROR aquí */}
      {errorMessage && <p id="login-error-message" style={{ color: 'red' }}>{errorMessage}</p>}
    </div>
  );
};

export default LoginForm;