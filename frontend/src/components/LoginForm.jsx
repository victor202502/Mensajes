// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

const LoginForm = () => {
  // 1. Cambia 'email' por 'username' en el estado inicial
  const [formData, setFormData] = useState({
    username: '', // <--- Cambio aquí
    password: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value, // Esto sigue funcionando igual
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    // El console log ahora mostrará { username: '...', password: '...' }
    console.log('Datos a enviar (Login):', formData);

    try {
      const apiUrl = 'http://localhost:5001/api/auth/login';
      // axios enviará el objeto formData que ahora contiene 'username'
      const response = await axios.post(apiUrl, formData);

      console.log('Respuesta del servidor:', response.data);
      setMessage('¡Acceso exitoso!');
      // localStorage.setItem('token', response.data.token); // Para cuando implementes JWT
      // Limpia el estado con username
      setFormData({ username: '', password: '' }); // <--- Cambio aquí
    } catch (error) {
      console.error('Error en el login:', error);
      setMessage(error.response?.data?.message || 'Error en el acceso. Verifica tus credenciales.');
    }
  };

  return (
    <div>
      <h2>Acceder</h2>
      <form onSubmit={handleSubmit}>
        {/* 2. Modifica este bloque completo */}
        <div>
          {/* Cambia el texto del label y el htmlFor */}
          <label htmlFor="login-username">Usuario:</label>
          <input
            type="text" // Cambia el tipo a 'text'
            id="login-username" // Cambia el id
            name="username" // ¡MUY IMPORTANTE! Cambia el name a 'username'
            value={formData.username} // Lee del estado formData.username
            onChange={handleChange}
            required
          />
        </div>
        {/* El bloque de la contraseña no necesita cambios */}
        <div>
          <label htmlFor="login-password">Contraseña:</label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit">Acceder</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default LoginForm;