// frontend/src/components/RegisterForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

// --- Obtén la URL base de la API desde las variables de entorno ---
// Vite expone las variables con prefijo VITE_ en import.meta.env
// Usamos un fallback a localhost:5001 para desarrollo local si .env no está configurado
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
// --------------------------------------------------------------

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Opcional: para indicar carga

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true); // Inicia carga
    console.log('Datos a enviar (Registro):', formData);
    console.log(`Usando API URL base: ${API_BASE_URL}`); // Verifica la URL usada

    try {
      // --- Construye la URL dinámicamente ---
      const apiUrl = `${API_BASE_URL}/api/auth/register`;
      // -------------------------------------

      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor (Registro):', response.data);
      setMessage(response.data?.message || '¡Registro exitoso!');
      setFormData({ username: '', password: '' }); // Limpiar formulario

    } catch (error) {
      console.error('Error en el registro:', error);
      // Mostrar error detallado si es posible
      if (error.response) {
        console.error('Error Data:', error.response.data);
        console.error('Error Status:', error.response.status);
        setMessage(error.response.data?.message || `Error del servidor (${error.response.status})`);
      } else if (error.request) {
        console.error('No se recibió respuesta:', error.request);
        setMessage('No se pudo conectar al servidor. Inténtalo más tarde.');
      } else {
        console.error('Error de configuración Axios:', error.message);
        setMessage(`Error inesperado: ${error.message}`);
      }
    } finally {
      setIsLoading(false); // Termina carga (tanto en éxito como en error)
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="register-username">Usuario:</label>
          <input
            type="text"
            id="register-username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            minLength="3"
            disabled={isLoading} // Deshabilita mientras carga
          />
        </div>
        <div>
          <label htmlFor="register-password">Contraseña:</label>
          <input
            type="password"
            id="register-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
            disabled={isLoading} // Deshabilita mientras carga
          />
        </div>
        {/* Muestra "Registrando..." en el botón si isLoading es true */}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Registrando...' : 'Registrarse'}
        </button>
      </form>
      {/* Muestra mensajes de éxito o error */}
      {message && <p>{message}</p>}
    </div>
  );
};

export default RegisterForm;