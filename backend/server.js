// backend/server.js

// 1. Importaciones de módulos necesarios
require('dotenv').config(); // Carga variables de entorno desde el archivo .env
const express = require('express');
const cors = require('cors');
// --- Importaciones Reales ---
const db = require('./db'); // Importa nuestro módulo de conexión a la DB
const bcrypt = require('bcryptjs'); // Importa bcrypt para contraseñas
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

// Ruta para el REGISTRO de nuevos usuarios (con lógica de DB real)
app.post('/api/auth/register', async (req, res) => {
  console.log('Recibido en /api/auth/register:', req.body);
  const { username, password } = req.body; // Lee username y password

  // --- Validación ---
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

  // --- Lógica Real con DB ---
  try {
    // 1. Verificar si el USERNAME ya existe en la DB
    const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'El nombre de usuario ya está en uso' }); // 409 Conflict
    }

    // 2. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Insertar el nuevo usuario en la DB
    const newUser = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    // 4. Respuesta de ÉXITO
    console.log('Usuario registrado exitosamente en DB:', newUser.rows[0]);
    res.status(201).json({
        message: `Usuario ${newUser.rows[0].username} registrado exitosamente.`,
        user: newUser.rows[0] // Devuelve datos seguros del usuario creado
    });

  } catch (err) {
      // Manejo de Errores
      console.error("Error en /api/auth/register:", err.message);
      res.status(500).json({ message: "Error interno del servidor al registrar usuario." });
  }
  // --- Fin Lógica Real con DB ---
});


// Ruta para el LOGIN de usuarios (con lógica de DB real)
app.post('/api/auth/login', async (req, res) => {
  console.log('Recibido en /api/auth/login:', req.body);
  const { username, password } = req.body; // Lee username y password

  // --- Validación ---
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }
  console.log('Validaciones pasadas para login.');

  // --- Lógica Real con DB ---
  try {
    // 1. Buscar al usuario por USERNAME en la DB
    // Es importante seleccionar el id y el hash de la contraseña
    const result = await db.query('SELECT id, username, password_hash, created_at FROM users WHERE username = $1', [username]);
    const user = result.rows[0]; // El usuario encontrado o undefined

    // 2. Si el usuario no existe
    if (!user) {
      console.log(`Intento de login fallido: Usuario '${username}' no encontrado.`);
      return res.status(401).json({ message: 'Credenciales inválidas' }); // 401 Unauthorized
    }

    // 3. Comparar la contraseña enviada con el hash guardado
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    // 4. Si la contraseña no coincide
    if (!isValidPassword) {
      console.log(`Intento de login fallido: Contraseña incorrecta para '${username}'.`);
      return res.status(401).json({ message: 'Credenciales inválidas' }); // 401 Unauthorized
    }

    // 5. ¡Login Exitoso!
    console.log(`Login exitoso para usuario: ${user.username} (ID: ${user.id})`);

    // TODO: Implementar generación de JWT aquí (siguiente paso)
    // const tokenPayload = { userId: user.id, username: user.username };
    // const secret = process.env.JWT_SECRET; // Necesitas definir JWT_SECRET en .env
    // const options = { expiresIn: '1h' };
    // const token = jwt.sign(tokenPayload, secret, options);

    // Respuesta de ÉXITO (sin JWT por ahora)
    res.status(200).json({
      message: `Acceso concedido para ${user.username}`,
      // Cuando tengas JWT: token: token,
      user: { // Enviar solo datos seguros del usuario (sin el hash!)
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });

  } catch (err) {
    // Manejo de Errores
    console.error("Error en /api/auth/login:", err.message);
    res.status(500).json({ message: "Error interno del servidor al intentar acceder." });
  }
  // --- Fin Lógica Real con DB ---
});

// --- Fin Rutas de Autenticación ---

// -----------------------------------------------------------------------------
// 7. Inicio del Servidor
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);

  // --- Verificación de Conexión a DB al iniciar ---
  db.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('\n*** ERROR AL VERIFICAR CONEXIÓN A DB ***\n', err);
      console.error('Asegúrate de que DATABASE_URL en .env es correcta y la DB está accesible.\n');
    } else {
      console.log('Conexión a la base de datos verificada exitosamente a las:', res.rows[0].now);
    }
  });
  // --- Fin Verificación ---
});