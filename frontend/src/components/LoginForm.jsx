// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

// --- Obtén la URL base de la API desde las variables de entorno ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
// --------------------------------------------------------------

const LoginForm = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Opcional: para indicar carga

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true); // Inicia carga
    console.log('Datos a enviar (Login):', formData);
    console.log(`Usando API URL base: ${API_BASE_URL}`); // Verifica la URL usada

    try {
      // --- Construye la URL dinámicamente ---
      const apiUrl = `${API_BASE_URL}/api/auth/login`;
      // -------------------------------------

      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor (Login):', response.data);

      if (response.data && response.data.user && response.data.user.username) {
        onLoginSuccess(response.data.user /*, response.data.token */);
      } else {
        console.error("Login exitoso (2xx) pero faltan datos del usuario en la respuesta:", response.data);
        setErrorMessage("Ocurrió un problema al cargar tu sesión. Intenta de nuevo.");
      }

    } catch (error) {
      console.error('Error en el login:', error);
      if (error.response) {
        console.error('Error Data:', error.response.data);
        console.error('Error Status:', error.response.status);
        setErrorMessage(error.response.data?.message || `Error del servidor (${error.response.status})`);
      } else if (error.request) {
        console.error('No se recibió respuesta:', error.request);
        setErrorMessage('No se pudo conectar al servidor. Inténtalo más tarde.');
      } else {
        console.error('Error de configuración Axios:', error.message);
        setErrorMessage(`Error inesperado: ${error.message}`);
      }
    } finally {
       setIsLoading(false); // Termina carga
    }
  };

  return (
    <div>
      <h2>Acceder</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-username">Usuario:</label>
          <input
            type="text"
            id="login-username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={isLoading} // Deshabilita mientras carga
            aria-describedby={errorMessage ? "login-error-message" : undefined}
          />
        </div>
        <div>
          <label htmlFor="login-password">Contraseña:</label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading} // Deshabilita mientras carga
            aria-describedby={errorMessage ? "login-error-message" : undefined}
          />
        </div>
        {/* Muestra "Accediendo..." en el botón si isLoading es true */}
        <button type="submit" disabled={isLoading}>
           {isLoading ? 'Accediendo...' : 'Acceder'}
        </button>
      </form>
      {/* Mostramos SÓLO los mensajes de ERROR aquí */}
      {errorMessage && <p id="login-error-message" style={{ color: 'red' }}>{errorMessage}</p>}
    </div>
  );
};

export default LoginForm;