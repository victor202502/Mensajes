// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

// Usa la variable de entorno VITE_API_URL o un valor por defecto
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Recibe la función onLoginSuccess de App.jsx
// <<< CAMBIO: La prop onAuthFailure ahora también se recibe (importante para errores) >>>
const LoginForm = ({ onLoginSuccess, onAuthFailure }) => {
  // Estado para los campos del formulario
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  // Estado para mensajes de error
  const [errorMessage, setErrorMessage] = useState('');
  // Estado para indicar si se está procesando la petición
  const [isLoading, setIsLoading] = useState(false);

  // Manejador para actualizar el estado cuando cambian los inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value, // Actualiza el campo correspondiente
    });
  };

  // Manejador para el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario
    setErrorMessage(''); // Limpia errores anteriores
    setIsLoading(true); // Indica que la carga ha comenzado
    console.log('Datos a enviar (Login):', formData);
    console.log(`Usando API URL base: ${API_BASE_URL}`);

    try {
      const apiUrl = `${API_BASE_URL}/api/auth/login`; // Construye la URL completa
      const response = await axios.post(apiUrl, formData); // Envía la petición POST

      console.log('Respuesta del servidor (Login):', response.data);

      // Verifica que la respuesta contenga los datos esperados
      if (response.data && response.data.user && response.data.token) {
        // Llama a onLoginSuccess pasando UN SOLO OBJETO que contiene 'user' y 'token'
        onLoginSuccess({
            user: response.data.user,
            token: response.data.token
        });
      } else {
        // Si la respuesta del servidor es 2xx pero no contiene los datos esperados
        console.error("Login exitoso (2xx) pero faltan datos (user/token) en la respuesta:", response.data);
        // <<< CAMBIO: Mensaje de error traducido >>>
        const errMsg = "Beim Laden Ihrer Sitzung ist ein Problem aufgetreten. Bitte versuchen Sie es erneut.";
        setErrorMessage(errMsg);
        // <<< CAMBIO: Notificar al padre del error si existe la función >>>
        if (onAuthFailure) onAuthFailure(errMsg);
      }

    } catch (error) {
      // Manejo de errores de la petición (red, servidor 4xx/5xx, etc.)
      console.error('Error en el login:', error);
      let errorMsg = ''; // <<< CAMBIO: Variable para el mensaje traducido >>>

      if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        console.error('Error Data:', error.response.data);
        console.error('Error Status:', error.response.status);
        // Muestra el mensaje de error del backend si existe (SIN TRADUCIR), si no, uno genérico traducido
        // Es mejor no traducir mensajes del backend directamente aquí
        errorMsg = error.response.data?.message || `Serverfehler (${error.response.status})`; // <<< CAMBIO: Mensaje genérico traducido >>>
      } else if (error.request) {
        // La petición se hizo pero no se recibió respuesta
        console.error('No se recibió respuesta:', error.request);
        // <<< CAMBIO: Mensaje de error traducido >>>
        errorMsg = 'Keine Verbindung zum Server möglich. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es später erneut.';
      } else {
        // Algo ocurrió al configurar la petición que lanzó un Error
        console.error('Error de configuración Axios:', error.message);
        // <<< CAMBIO: Mensaje de error traducido >>>
        errorMsg = `Unerwarteter Fehler beim Anmeldeversuch: ${error.message}`;
      }
      setErrorMessage(errorMsg); // <<< CAMBIO: Establece el mensaje de error (traducido o del backend) >>>
      // <<< CAMBIO: Notificar al padre del error si existe la función >>>
      if (onAuthFailure) onAuthFailure(errorMsg);

    } finally {
       // Esto se ejecuta siempre, tanto si hubo éxito como si hubo error
       setIsLoading(false); // Indica que la carga ha terminado
    }
  };

  // Renderizado del componente
  return (
    <div>
      {/* El <h2> podría estar en App.jsx, si no, necesitas traducirlo también */}
      {/* <h2>Anmelden</h2> */}
      <form onSubmit={handleSubmit}>
        <div>
          {/* <<< CAMBIO: Texto de la etiqueta traducido >>> */}
          <label htmlFor="login-username">Benutzername:</label>
          <input
            type="text"
            id="login-username"
            name="username" // Coincide con la clave en formData
            value={formData.username}
            onChange={handleChange}
            required
            disabled={isLoading} // Deshabilitado mientras carga
            autoComplete="username" // Ayuda al navegador a autocompletar
            aria-describedby={errorMessage ? "login-error-message" : undefined} // Asocia con el mensaje de error para accesibilidad
          />
        </div>
        <div>
          {/* <<< CAMBIO: Texto de la etiqueta traducido >>> */}
          <label htmlFor="login-password">Passwort:</label>
          <input
            type="password"
            id="login-password"
            name="password" // Coincide con la clave en formData
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading} // Deshabilitado mientras carga
            autoComplete="current-password" // Ayuda al navegador a autocompletar
            aria-describedby={errorMessage ? "login-error-message" : undefined} // Asocia con el mensaje de error
          />
        </div>
        <button type="submit" disabled={isLoading}>
           {/* <<< CAMBIO: Textos del botón traducidos >>> */}
           {isLoading ? 'Melde an...' : 'Anmelden'}
        </button>
      </form>
      {/* Muestra el mensaje de error si existe (el mensaje ya está traducido en el estado) */}
      {errorMessage && <p id="login-error-message" style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</p>}
    </div>
  );
};

export default LoginForm;