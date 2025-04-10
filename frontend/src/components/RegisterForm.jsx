// frontend/src/components/RegisterForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);
    console.log('Datos a enviar (Registro):', formData);
    console.log(`Usando API URL base: ${API_BASE_URL}`);

    try {
      // --- RUTA CORRECTA ---
      const apiUrl = `${API_BASE_URL}/api/auth/register`;
      // --------------------
      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor (Registro):', response.data);
      setMessage(response.data?.message || '¡Registro exitoso!');
      setFormData({ username: '', password: '' });

    } catch (error) {
      console.error('Error en el registro:', error);
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
      setIsLoading(false);
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
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Registrando...' : 'Registrarse'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default RegisterForm;