// frontend/src/components/RegisterForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

const RegisterForm = () => {
  // 1. Cambia 'email' por 'username' en el estado inicial
  const [formData, setFormData] = useState({
    username: '', // <--- Cambio aquí
    password: '',
  });
  const [message, setMessage] = useState('');

  // El handler de cambios no necesita modificación
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    // El console log ahora mostrará { username: '...', password: '...' }
    console.log('Datos a enviar (Registro):', formData);

    try {
      // La URL del backend sigue siendo la misma para el endpoint de registro
      const apiUrl = 'http://localhost:5001/api/auth/register';

      // axios enviará el objeto formData que ahora contiene 'username'
      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor:', response.data);
      // Usa el mensaje del backend si existe, o uno genérico
      setMessage(response.data?.message || '¡Registro exitoso!');
      // 2. Limpia el estado con username
      setFormData({ username: '', password: '' }); // <--- Cambio aquí
    } catch (error) {
      console.error('Error en el registro:', error);
      setMessage(error.response?.data?.message || 'Error en el registro. Inténtalo de nuevo.');
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleSubmit}>
        {/* 3. Modifica este bloque completo */}
        <div>
          {/* Cambia el texto del label y el htmlFor */}
          <label htmlFor="register-username">Usuario:</label>
          <input
            type="text" // Cambia el tipo a 'text'
            id="register-username" // Cambia el id
            name="username" // ¡MUY IMPORTANTE! Cambia el name a 'username'
            value={formData.username} // Lee del estado formData.username
            onChange={handleChange}
            required
            minLength="3" // Puedes ajustar la longitud mínima para un usuario
          />
        </div>
        {/* El bloque de la contraseña no necesita cambios */}
        <div>
          <label htmlFor="register-password">Contraseña:</label>
          <input
            type="password"
            id="register-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6" // Mantenemos la validación de contraseña
          />
        </div>
        <button type="submit">Registrarse</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default RegisterForm;