// frontend/src/components/RegisterForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// <<< CAMBIO: Recibe las props onRegisterSuccess y onAuthFailure de App.jsx >>>
const RegisterForm = ({ onRegisterSuccess, onAuthFailure }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  // <<< CAMBIO: Usar 'errorMessage' para errores, 'successMessage' para éxito >>>
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Limpiar mensajes al empezar a escribir de nuevo
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage(''); // Limpiar mensaje de éxito anterior
    setIsLoading(true);
    console.log('Datos a enviar (Registro):', formData);
    console.log(`Usando API URL base: ${API_BASE_URL}`);

    try {
      const apiUrl = `${API_BASE_URL}/api/auth/register`;
      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor (Registro):', response.data);
      const successMsg = response.data?.message || 'Registrierung erfolgreich!'; // <<< CAMBIO: Mensaje traducido por defecto >>>
      setSuccessMessage(successMsg); // Muestra el mensaje de éxito
      setFormData({ username: '', password: '' }); // Limpia el formulario

      // <<< CAMBIO: Notifica al componente padre (App.jsx) >>>
      if (onRegisterSuccess) {
          // Pasa el mensaje del backend a App.jsx
          onRegisterSuccess(successMsg);
      }

    } catch (error) {
      console.error('Error en el registro:', error);
      let errorMsg = ''; // <<< CAMBIO: Variable para mensaje de error >>>
      if (error.response) {
        console.error('Error Data:', error.response.data);
        console.error('Error Status:', error.response.status);
        // Usa el mensaje del backend (sin traducir) o uno genérico traducido
        errorMsg = error.response.data?.message || `Serverfehler (${error.response.status})`; // <<< CAMBIO: Mensaje genérico traducido >>>
      } else if (error.request) {
        console.error('No se recibió respuesta:', error.request);
        // <<< CAMBIO: Mensaje traducido >>>
        errorMsg = 'Keine Verbindung zum Server möglich. Bitte versuchen Sie es später erneut.';
      } else {
        console.error('Error de configuración Axios:', error.message);
         // <<< CAMBIO: Mensaje traducido >>>
        errorMsg = `Unerwarteter Fehler: ${error.message}`;
      }
      setErrorMessage(errorMsg); // <<< CAMBIO: Establece el mensaje de error >>>

      // <<< CAMBIO: Notifica al componente padre (App.jsx) del error >>>
      if (onAuthFailure) {
          onAuthFailure(errorMsg);
      }

    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* El <h2> está en App.jsx, así que no se necesita aquí */}
      {/* <h2>Registrierung</h2> */}
      <form onSubmit={handleSubmit}>
        <div>
          {/* <<< CAMBIO: Texto de etiqueta traducido >>> */}
          <label htmlFor="register-username">Benutzername:</label>
          <input
            type="text"
            id="register-username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            minLength="3" // Requisito del backend
            disabled={isLoading}
            aria-describedby={errorMessage ? "register-error-message" : successMessage ? "register-success-message" : undefined}
          />
        </div>
        <div>
           {/* <<< CAMBIO: Texto de etiqueta traducido >>> */}
          <label htmlFor="register-password">Passwort:</label>
          <input
            type="password"
            id="register-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6" // Requisito del backend
            disabled={isLoading}
            aria-describedby={errorMessage ? "register-error-message" : successMessage ? "register-success-message" : undefined}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {/* <<< CAMBIO: Textos del botón traducidos >>> */}
          {isLoading ? 'Registriere...' : 'Registrieren'}
        </button>
      </form>
      {/* <<< CAMBIO: Mostrar mensajes de error o éxito >>> */}
      {errorMessage && <p id="register-error-message" style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</p>}
      {successMessage && <p id="register-success-message" style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>}
    </div>
  );
};

export default RegisterForm;