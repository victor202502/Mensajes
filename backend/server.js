// backend/server.js

// 1. Importaciones de módulos necesarios
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// (Opcional pero recomendado para rutas protegidas más adelante)
// const authMiddleware = require('./middleware/authMiddleware'); // Asegúrate de crear este archivo

// --- Lista de Orígenes Permitidos ---
// Incluye el localhost para desarrollo y la URL de producción leída de .env
const allowedOrigins = [
    'http://localhost:5173',   // Tu frontend local (asegúrate que el puerto sea el de Vite)
    process.env.FRONTEND_URL // Tu frontend en Render (ej: https://mensajes-frontend.onrender.com)
    // Puedes añadir 'http://127.0.0.1:5173' si a veces accedes por IP
].filter(Boolean); // Elimina valores undefined/null si FRONTEND_URL no está definido
// ----------------------------------

// 2. Configuración de CORS con Función Origin
const corsOptions = {
  origin: function (origin, callback) {
    // Permite peticiones si el 'origin' está en nuestra lista blanca
    // o si no hay 'origin' (peticiones desde el mismo servidor, curl, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      console.log(`CORS Check: Origen '${origin || 'N/A'}' permitido.`);
      callback(null, true); // Permite la petición
    } else {
      console.warn(`CORS Check: Origen '${origin}' BLOQUEADO. Permitidos: ${allowedOrigins.join(', ')}`);
      callback(new Error('Este origen no está permitido por la política CORS.')); // Bloquea la petición
    }
  },
  credentials: true, // Importante si planeas usar cookies o encabezados de autorización complejos
  optionsSuccessStatus: 200 // Algunas implementaciones prefieren 200 para OPTIONS
};

// 3. Creación de la aplicación Express
const app = express();

// 4. Definición del puerto
const PORT = process.env.PORT || 5001;

// 5. Middlewares
// --- Aplicar la configuración CORS con la función 'origin' ---
// Ya no necesitamos app.options('*', ...) porque la función origin maneja preflight
app.use(cors(corsOptions));
// -------------------------------------------------------------

// Otros Middlewares
app.use(express.json()); // Para parsear JSON
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formulario

// -----------------------------------------------------------------------------
// 6. Definición de Rutas
// -----------------------------------------------------------------------------

// Ruta de prueba básica
app.get('/', (req, res) => {
  res.send('API funcionando correctamente!');
});

// --- Rutas de Autenticación ---

// Ruta para el REGISTRO
app.post('/api/auth/register', async (req, res) => {
  console.log('*** POST /api/auth/register - Handler ENTRY ***');
  console.log('Recibido en /api/auth/register:', req.body);
  const { username, password } = req.body;

  // Validaciones...
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }
  if (password.length < 6) {
     return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (username.length < 3) {
    return res.status(400).json({ message: 'El nombre de usuario debe tener al menos 3 caracteres' });
  }
  console.log('Validaciones pasadas para registro.');

  try {
    const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'El nombre de usuario ya está en uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    console.log('Usuario registrado exitosamente en DB:', newUser.rows[0]);
    res.status(201).json({
        message: `Usuario ${newUser.rows[0].username} registrado exitosamente.`,
        user: newUser.rows[0]
    });

  } catch (err) {
      console.error("Error en /api/auth/register:", err.message);
      res.status(500).json({ message: "Error interno del servidor al registrar usuario." });
  }
});


// Ruta para el LOGIN (con JWT)
app.post('/api/auth/login', async (req, res) => {
  console.log('*** POST /api/auth/login - Handler ENTRY ***');
  console.log('Recibido en /api/auth/login:', req.body);
  const { username, password } = req.body;

  // Validaciones...
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }
  console.log('Validaciones pasadas para login.');

  try {
    const result = await db.query('SELECT id, username, password_hash, created_at FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      console.log(`Intento de login fallido: Usuario '${username}' no encontrado.`);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log(`Intento de login fallido: Contraseña incorrecta para '${username}'.`);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generación de JWT
    console.log(`Login exitoso para usuario: ${user.username} (ID: ${user.id}). Generando token...`);
    const tokenPayload = { userId: user.id, username: user.username };
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("¡ERROR CRÍTICO: JWT_SECRET no está definido!");
        return res.status(500).json({ message: "Error de configuración del servidor." });
    }
    const options = { expiresIn: '1h' };
    const token = jwt.sign(tokenPayload, secret, options);

    // Envío de respuesta con token
    res.status(200).json({
      message: `Acceso concedido para ${user.username}`,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });

  } catch (err) {
    console.error("Error en /api/auth/login:", err.message);
    res.status(500).json({ message: "Error interno del servidor al intentar acceder." });
  }
});

// --- Fin Rutas de Autenticación ---

/* --- Ejemplo Ruta Protegida ---
const authMiddleware = require('./middleware/authMiddleware');
app.get('/api/messages', authMiddleware, async (req, res) => { ... });
*/

// -----------------------------------------------------------------------------
// 7. Inicio del Servidor
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);

  db.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('\n*** ERROR AL VERIFICAR CONEXIÓN A DB ***\n', err);
    } else {
      console.log('Conexión a la base de datos verificada exitosamente a las:', res.rows[0].now);
    }
  });
});