// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
// Asegúrate de que la ruta a tu archivo db.js sea correcta desde aquí
// Si db.js está en la carpeta 'backend', necesitas '../db'
const db = require('../db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Verifica que el encabezado exista y tenga el formato correcto 'Bearer TOKEN'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("AuthMiddleware: Rechazado - Cabecera Authorization ausente o mal formada.");
    return res.status(401).json({ message: 'No autorizado: Token no proporcionado o inválido.' });
  }

  // Extrae el token
  const token = authHeader.split(' ')[1];
  if (!token) {
     console.warn("AuthMiddleware: Rechazado - Token vacío después de 'Bearer '.");
     return res.status(401).json({ message: 'No autorizado: Token no proporcionado.' });
  }

  try {
    // Verifica el token usando el secreto de tu .env
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("AuthMiddleware Error: JWT_SECRET no está definido en .env!");
        // No expongas detalles internos, pero sí loguea el error
        return res.status(500).json({ message: 'Error de configuración interna del servidor.' });
    }

    const decoded = jwt.verify(token, secret);

    // Opcional pero MUY recomendado: Verificar si el usuario aún existe en la DB
    // Esto previene que tokens válidos de usuarios eliminados sigan funcionando
    // const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [decoded.userId]);
    // if (userCheck.rows.length === 0) {
    //   console.warn(`AuthMiddleware: Rechazado - Usuario ${decoded.userId} del token ya no existe.`);
    //   return res.status(401).json({ message: 'No autorizado: Usuario no encontrado.' });
    // }

    // Adjuntar la información decodificada del usuario (userId, username) al objeto `req`
    // para que las rutas posteriores puedan usarla.
    req.user = {
      userId: decoded.userId,
      username: decoded.username // Asumiendo que guardaste el username en el payload del token
    };

    console.log(`AuthMiddleware: Usuario ${req.user.username} (ID: ${req.user.userId}) autenticado para ruta HTTP.`);

    // Pasa la solicitud al siguiente middleware o al manejador de la ruta
    next();

  } catch (err) {
    // Maneja diferentes errores de JWT
    if (err.name === 'TokenExpiredError') {
        console.warn("AuthMiddleware: Rechazado - Token expirado.");
        return res.status(401).json({ message: 'No autorizado: Token expirado.' });
    } else if (err.name === 'JsonWebTokenError') {
        console.warn("AuthMiddleware: Rechazado - Token inválido:", err.message);
        return res.status(401).json({ message: 'No autorizado: Token inválido.' });
    } else {
        // Otros errores inesperados
        console.error("AuthMiddleware Error inesperado:", err);
        return res.status(500).json({ message: 'Error interno al verificar la autenticación.' });
    }
  }
};

module.exports = authMiddleware;