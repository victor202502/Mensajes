// backend/server.js

// 1. Importaciones
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Necesario para Socket.IO
const { Server } = require("socket.io"); // Importa Server de Socket.IO
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware de autenticación HTTP (Asegúrate de crear este archivo si lo usas)
const authMiddleware = require('./middleware/authMiddleware'); // <<< CAMBIO: Importa el middleware

// --- Lista de Orígenes Permitidos (para CORS) ---
const allowedOrigins = [
    'http://localhost:5173', // Tu frontend dev
    process.env.FRONTEND_URL // Lee de .env (ej: https://tu-app-deployada.com)
].filter(Boolean); // filter(Boolean) elimina entradas undefined/null si FRONTEND_URL no está en .env

// 2. Configuración de CORS para Rutas HTTP (Express)
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como Postman, curl) en desarrollo o si lo necesitas
    // En producción estricta, podrías querer quitar `!origin`
    if (!origin || allowedOrigins.includes(origin)) {
      // console.log(`CORS (HTTP): Origen '${origin || 'N/A'}' permitido.`);
      callback(null, true);
    } else {
      console.warn(`CORS (HTTP): Origen '${origin}' BLOQUEADO.`);
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// 3. Creación de la aplicación Express Y Servidor HTTP
const app = express();
const server = http.createServer(app); // Servidor HTTP que usa Express

// 4. Inicialización de Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Permite orígenes de la lista
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 5. Definición del puerto
const PORT = process.env.PORT || 5001;

// 6. Middlewares Express
app.use(cors(corsOptions)); // Aplica CORS a las rutas HTTP
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 7. Middleware de Autenticación Socket.IO (Sin cambios, esto es para WebSockets)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
     console.log("Socket Auth: Rechazado - No hay token");
     return next(new Error("Authentication error: Token not provided"));
  }
  try {
     // Asegúrate que JWT_SECRET esté definido en tu .env
     if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no está configurado en el servidor.");
     const decoded = jwt.verify(token, process.env.JWT_SECRET);
     socket.user = decoded; // Contiene { userId, username }
     console.log(`Socket Auth: Conectado - User ${socket.user.username} (ID: ${socket.user.userId})`);
     next();
  } catch (err) {
     console.log("Socket Auth: Rechazado - Token inválido:", err.message);
     next(new Error("Authentication error: Invalid token"));
  }
});

// 8. Lógica de Conexión de Socket.IO (Mensajería 1 a 1) (Sin cambios)
io.on('connection', (socket) => {
   const userId = socket.user.userId; // El middleware ya lo añadió
   const username = socket.user.username;
   const userIdString = userId.toString(); // Para nombres de sala

   console.log(`Cliente conectado y autenticado: ${socket.id}, Usuario: ${username} (ID: ${userId})`);

   // Unir al usuario a su propia sala basada en su ID
   socket.join(userIdString);
   console.log(`Usuario ${username} (ID: ${userId}) unido a la sala ${userIdString}`);

   // Escuchar evento 'sendMessage' { recipientUsername, content }
   socket.on('sendMessage', async ({ recipientUsername, content }) => {
     console.log(`Mensaje recibido de ${username} (ID: ${userId}) para ${recipientUsername}: ${content}`);
     const trimmedContent = content?.trim();
     const trimmedRecipient = recipientUsername?.trim();

     // Validaciones
     if (!trimmedRecipient) {
        console.log("Destinatario vacío ignorado.");
        return socket.emit('messageError', { error: 'Debes especificar un destinatario.' });
     }
     if (!trimmedContent) {
        console.log("Mensaje vacío ignorado.");
        return socket.emit('messageError', { error: 'El mensaje no puede estar vacío.' });
     }
     if (trimmedRecipient.toLowerCase() === username.toLowerCase()) {
         console.log("Intento de enviarse mensaje a sí mismo.");
         return socket.emit('messageError', { error: 'No puedes enviarte mensajes a ti mismo.'});
     }

     try {
       // 1. Buscar ID del destinatario
       const recipientCheck = await db.query('SELECT id FROM users WHERE username ILIKE $1', [trimmedRecipient]); // ILIKE para case-insensitive
       if (recipientCheck.rows.length === 0) {
          console.log(`Destinatario '${trimmedRecipient}' no encontrado.`);
          return socket.emit('messageError', { error: `Usuario '${trimmedRecipient}' no encontrado.` });
       }
       const recipientId = recipientCheck.rows[0].id;
       const recipientIdString = recipientId.toString();

       // 2. Guardar mensaje en DB (con recipient_id)
       const newMessage = await db.query(
         'INSERT INTO messages (content, sender_id, recipient_id) VALUES ($1, $2, $3) RETURNING id, content, sender_id, recipient_id, created_at',
         [trimmedContent, userId, recipientId] // Usa userId del socket autenticado
       );

       // 3. Preparar mensaje para emitir (incluyendo info completa de sender/recipient)
       const messageToSend = {
         id: newMessage.rows[0].id,
         content: newMessage.rows[0].content,
         createdAt: newMessage.rows[0].created_at,
         sender: { id: userId, username: username }, // Usa datos del socket
         recipient: { id: recipientId, username: trimmedRecipient } // Usa datos encontrados
       };

       // 4. Emitir a la sala del DESTINATARIO (si está conectado)
       io.to(recipientIdString).emit('newMessage', messageToSend);
       console.log(`Mensaje emitido a la sala del destinatario: ${recipientIdString} (Usuario: ${trimmedRecipient})`);

       // 5. Emitir de vuelta a la sala del REMITENTE (para que vea su propio mensaje)
       io.to(userIdString).emit('newMessage', messageToSend);
       console.log(`Mensaje emitido a la sala del remitente: ${userIdString} (Usuario: ${username})`);

       console.log(`Mensaje de ${username} para ${trimmedRecipient} procesado y emitido.`);

     } catch (dbError) {
        console.error(`Error DB/Socket al procesar mensaje de ${username} para ${trimmedRecipient}:`, dbError);
        socket.emit('messageError', { error: 'Error interno al enviar el mensaje.' });
     }
   });

   // Manejar desconexión
   socket.on('disconnect', (reason) => {
     console.log(`Cliente desconectado: ${socket.id}, Usuario: ${username} (ID: ${userId}), Razón: ${reason}`);
     // No es necesario 'leave', al desconectar se sale automáticamente de las salas
   });
});


// -----------------------------------------------------------------------------
// 9. Definición de Rutas Express HTTP (API)
// -----------------------------------------------------------------------------
app.get('/', (req, res) => { res.send('API funcionando correctamente!'); });

// Ruta Registro (sin cambios)
app.post('/api/auth/register', async (req, res) => {
  console.log('*** POST /api/auth/register - Handler ENTRY ***');
  const { username, password } = req.body;
  // Validaciones básicas
  if (!username || !password) return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  if (username.length < 3) return res.status(400).json({ message: 'El nombre de usuario debe tener al menos 3 caracteres' });
  console.log('Validaciones pasadas para registro.');
  try {
    // Verificar si el usuario ya existe (case-insensitive)
    const userCheck = await db.query('SELECT id FROM users WHERE username ILIKE $1', [username]);
    if (userCheck.rows.length > 0) return res.status(409).json({ message: 'El nombre de usuario ya está en uso' });

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insertar nuevo usuario
    const newUser = await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
        [username, passwordHash]
    );
    console.log('Usuario registrado exitosamente en DB:', newUser.rows[0]);
    // No enviar token aquí, el usuario debe hacer login después de registrarse
    res.status(201).json({ message: `Usuario ${newUser.rows[0].username} registrado exitosamente. Por favor, inicia sesión.`, user: {id: newUser.rows[0].id, username: newUser.rows[0].username} });
  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ message: "Error interno al registrar usuario." });
  }
});

// Ruta Login (sin cambios funcionales, añadido chequeo JWT_SECRET)
app.post('/api/auth/login', async (req, res) => {
  console.log('*** POST /api/auth/login - Handler ENTRY ***');
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  console.log(`Intento de login para usuario: ${username}`);
  try {
    // Buscar usuario (case-insensitive)
    const result = await db.query('SELECT id, username, password_hash, created_at FROM users WHERE username ILIKE $1', [username]);
    const user = result.rows[0];
    if (!user) {
        console.log(`Login fallido: Usuario '${username}' no encontrado.`);
        return res.status(401).json({ message: 'Credenciales inválidas' }); // Mensaje genérico
    }

    // Comparar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        console.log(`Login fallido: Contraseña incorrecta para '${username}'.`);
        return res.status(401).json({ message: 'Credenciales inválidas' }); // Mensaje genérico
    }

    console.log(`Login exitoso para usuario: ${user.username} (ID: ${user.id}). Generando token...`);

    // Generar Token JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("¡ERROR CRÍTICO: JWT_SECRET no está definido en .env!");
        return res.status(500).json({ message: "Error interno del servidor (configuración)." });
    }
    const tokenPayload = { userId: user.id, username: user.username }; // Incluye ID y username
    const options = { expiresIn: '1h' }; // O el tiempo que prefieras
    const token = jwt.sign(tokenPayload, secret, options);

    // Enviar respuesta exitosa
    res.status(200).json({
        message: `Acceso concedido para ${user.username}`,
        token: token,
        user: { id: user.id, username: user.username, created_at: user.created_at } // Devuelve info del usuario
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ message: "Error interno durante el login." });
  }
});




app.get('/api/users', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId; // Obtenido del token por authMiddleware
  console.log(`Solicitud GET /api/users recibida de Usuario ID: ${currentUserId}`);

  try {
      // Consulta para obtener todos los usuarios EXCEPTO el actual
      const result = await db.query(
          'SELECT id, username FROM users WHERE id != $1 ORDER BY username ASC',
          [currentUserId]
      );

      const users = result.rows;
      console.log(`Devolviendo ${users.length} usuarios para Usuario ID: ${currentUserId}`);
      res.status(200).json(users); // Devuelve un array de objetos { id, username }

  } catch (err) {
      console.error(`Error al obtener lista de usuarios para Usuario ID ${currentUserId}:`, err);
      res.status(500).json({ message: "Error al obtener la lista de usuarios." });
  }
});





// --- Ruta Historial Mensajes (MODIFICADA) ---
// <<< CAMBIO: Se añade authMiddleware para proteger la ruta y obtener req.user
app.get('/api/messages', authMiddleware, async (req, res) => {
    // <<< CAMBIO: El middleware ya verificó el token y añadió req.user si es válido
    const currentUserId = req.user.userId;
    console.log(`Solicitud de historial de mensajes recibida para Usuario ID: ${currentUserId}`);

    // <<< CAMBIO: Doble chequeo por si acaso, aunque authMiddleware debería haberlo hecho
    if (!currentUserId) {
        return res.status(401).json({ message: "No autorizado (ID de usuario no encontrado después de autenticación)." });
    }

    try {
       // <<< CAMBIO: Consulta SQL modificada con WHERE para filtrar por sender_id O recipient_id
       const result = await db.query(`
          SELECT m.id, m.content, m.created_at AS "createdAt",
                 s.id AS sender_id, s.username AS sender_username,
                 r.id AS recipient_id, r.username AS recipient_username
          FROM messages m
          JOIN users s ON m.sender_id = s.id        -- Remitente siempre existe
          LEFT JOIN users r ON m.recipient_id = r.id -- Destinatario puede ser NULL (aunque en tu lógica actual, siempre hay uno)
          WHERE m.sender_id = $1 OR m.recipient_id = $1 -- <<< CAMBIO PRINCIPAL: Filtrar por el usuario actual
          ORDER BY m.created_at ASC                 -- Ordenar por fecha de creación
          -- LIMIT 100                              -- Puedes descomentar si quieres limitar la cantidad de historial
       `, [currentUserId]); // <<< CAMBIO: Pasar el ID del usuario actual como parámetro seguro

       // El mapeo de datos sigue siendo el mismo
       const messages = result.rows.map(row => ({
          id: row.id, content: row.content, createdAt: row.createdAt,
          sender: { id: row.sender_id, username: row.sender_username },
          // Incluye destinatario solo si existe en la fila (gracias al LEFT JOIN y la condición WHERE)
          recipient: row.recipient_id ? { id: row.recipient_id, username: row.recipient_username } : null
       }));

       console.log(`Historial devuelto para Usuario ID ${currentUserId}: ${messages.length} mensajes.`);
       res.status(200).json(messages); // Devuelve solo los mensajes relevantes

    } catch (err) {
       // <<< CAMBIO: Mejor log de error incluyendo para quién falló
       console.error(`Error al obtener mensajes para Usuario ID ${currentUserId}:`, err);
       res.status(500).json({ message: "Error al cargar el historial de mensajes." });
    }
 });


// -----------------------------------------------------------------------------
// 10. Inicio del Servidor
// -----------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Servidor (HTTP + WebSocket) corriendo en http://localhost:${PORT}`);
  // Verificar conexión a DB al inicio
  db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('\n*******************************************');
        console.error('*** ERROR AL CONECTAR CON LA BASE DE DATOS ***');
        console.error('*******************************************');
        console.error('Detalles:', err.message);
        console.error('\nAsegúrate de que la base de datos esté corriendo y las credenciales en .env (o configuración de db.js) sean correctas.');
        // Podrías querer salir si la DB no conecta: process.exit(1);
    }
    else {
        console.log('-> Conexión a la base de datos verificada exitosamente a las:', res.rows[0].now);
    }
  });
  // Verificar que JWT_SECRET está cargado
  if (!process.env.JWT_SECRET) {
      console.warn('\n*******************************************');
      console.warn('*** ADVERTENCIA: JWT_SECRET no definido en .env ***');
      console.warn('*******************************************');
      console.warn('La autenticación JWT fallará. Asegúrate de tener JWT_SECRET en tu archivo .env');
  } else {
      console.log('-> JWT_SECRET cargado correctamente.');
  }
});