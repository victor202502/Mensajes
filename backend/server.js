// backend/server.js

// 1. Importaciones de módulos necesarios
require('dotenv').config(); // Carga variables de entorno desde el archivo .env
const express = require('express');
const cors = require('cors');
// Más adelante importarás la conexión a la DB y bcrypt:
// const db = require('./db'); // Asumiendo que creas un archivo db.js
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken'); // Para JWT más adelante

// 2. Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};

// 3. Creación de la aplicación Express
const app = express();

// 4. Definición del puerto
const PORT = process.env.PORT || 5001;

// 5. Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// 6. Definición de Rutas
// -----------------------------------------------------------------------------

// Ruta de prueba básica
app.get('/', (req, res) => {
  res.send('API funcionando correctamente!');
});

// --- Rutas de Autenticación ---

// Ruta para el REGISTRO de nuevos usuarios (AHORA USA USERNAME)
app.post('/api/auth/register', async (req, res) => {
  console.log('Recibido en /api/auth/register:', req.body);
  // --- CORREGIDO: Leer username en lugar de email ---
  const { username, password } = req.body;

  // --- Validación ---
  // --- CORREGIDO: Validar username y mensaje de error ---
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }

  if (password.length < 6) {
     return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  // --- CORREGIDO: Añadir validación de longitud para username (si no la tenías) ---
  if (username.length < 3) {
    return res.status(400).json({ message: 'El nombre de usuario debe tener al menos 3 caracteres' });
 }

  console.log('Validaciones pasadas para registro.');

  // --- Placeholder: Lógica Real con DB (TODO) ---
  try {
    // TODO 1: Verificar si el USERNAME ya existe en la DB
    // const userExists = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    // if (userExists.rows.length > 0) {
    //   return res.status(409).json({ message: 'El nombre de usuario ya está en uso' }); // 409 Conflict
    // }

    // TODO 2: Hashear la contraseña
    // const salt = await bcrypt.genSalt(10);
    // const passwordHash = await bcrypt.hash(password, salt);

    // TODO 3: Insertar el nuevo usuario en la DB
    // const newUser = await db.query(
    //   'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
    //   [username, passwordHash]
    // );

    // Respuesta de ÉXITO (simulada por ahora)
    // --- CORREGIDO: Usar username en los logs y mensaje ---
    console.log(`Simulando registro para: ${username}`);
    res.status(201).json({ message: `Usuario ${username} registrado exitosamente (simulado)` });

  } catch (err) {
      // TODO: Manejar errores de base de datos o bcrypt
      console.error("Error en /api/auth/register:", err.message);
      res.status(500).json({ message: "Error interno del servidor al registrar usuario." });
  }
  // --- Fin Placeholder ---
});


// Ruta para el LOGIN de usuarios (Usa USERNAME)
app.post('/api/auth/login', async (req, res) => {
  console.log('Recibido en /api/auth/login:', req.body);
  const { username, password } = req.body; // Correcto: Espera username

  // --- Validación ---
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' }); // Correcto
  }

  console.log('Validaciones pasadas para login.');

  // --- Placeholder: Lógica Real con DB y JWT (TODO) ---
  try {
    // TODO 1: Buscar al usuario por USERNAME en la DB
    // const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    // const user = result.rows[0];

    // TODO 2: Si el usuario no existe
    // if (!user) {
    //   return res.status(401).json({ message: 'Credenciales inválidas' }); // 401 Unauthorized
    // }

    // TODO 3: Comparar la contraseña enviada con el hash guardado
    // const isValidPassword = await bcrypt.compare(password, user.password_hash);
    // if (!isValidPassword) {
    //   return res.status(401).json({ message: 'Credenciales inválidas' }); // 401 Unauthorized
    // }

    // TODO 4: Si la contraseña coincide, generar un token JWT
    // const tokenPayload = { userId: user.id, username: user.username }; // Incluir lo necesario
    // const secret = process.env.JWT_SECRET; // Necesitas definir JWT_SECRET en .env
    // const options = { expiresIn: '1h' }; // O el tiempo que desees
    // const token = jwt.sign(tokenPayload, secret, options);

    // Respuesta de ÉXITO (simulada por ahora)
    console.log(`Simulando login para: ${username}`);
    res.status(200).json({
      message: `Acceso concedido para ${username} (simulado)`,
      // En el futuro enviarías el token:
      // token: token,
      // user: { id: user.id, username: user.username } // Enviar datos seguros del usuario
    });

  } catch (err) {
    // TODO: Manejar errores de base de datos, bcrypt o jwt
    console.error("Error en /api/auth/login:", err.message);
    res.status(500).json({ message: "Error interno del servidor al intentar acceder." });
  }
  // --- Fin Placeholder ---
});

// --- Fin Rutas de Autenticación ---

// -----------------------------------------------------------------------------
// 7. Inicio del Servidor
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);

  // TODO: Conectar a la base de datos al iniciar
  // try {
  //   await db.pool.query('SELECT NOW()'); // Intenta una consulta simple para verificar la conexión
  //   console.log('Conexión a la base de datos establecida exitosamente.');
  // } catch (error) {
  //   console.error('*** ERROR AL CONECTAR A LA BASE DE DATOS ***:', error.message);
  // }
});