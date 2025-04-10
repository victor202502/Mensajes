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
// const authMiddleware = require('./middleware/authMiddleware');

// --- Lista de Orígenes Permitidos (para CORS) ---
const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL // Lee de .env (ej: https://...)
].filter(Boolean);

// 2. Configuración de CORS para Rutas HTTP (Express)
const corsOptions = {
  origin: function (origin, callback) {
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

// 7. Middleware de Autenticación Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
     console.log("Socket Auth: Rechazado - No hay token");
     return next(new Error("Authentication error: Token not provided"));
  }
  try {
     const decoded = jwt.verify(token, process.env.JWT_SECRET);
     socket.user = decoded;
     console.log(`Socket Auth: Conectado - User ${socket.user.username} (ID: ${socket.user.userId})`);
     next();
  } catch (err) {
     console.log("Socket Auth: Rechazado - Token inválido:", err.message);
     next(new Error("Authentication error: Invalid token"));
  }
});

// 8. Lógica de Conexión de Socket.IO (Mensajería 1 a 1)
io.on('connection', (socket) => {
   const userIdString = socket.user.userId.toString();
   const username = socket.user.username;

   console.log(`Cliente conectado y autenticado: ${socket.id}, Usuario: ${username} (ID: ${userIdString})`);

   // Unir al usuario a su propia sala basada en su ID
   socket.join(userIdString);
   console.log(`Usuario ${username} unido a la sala ${userIdString}`);

   // Escuchar evento 'sendMessage' { recipientUsername, content }
   socket.on('sendMessage', async ({ recipientUsername, content }) => {
     console.log(`Mensaje recibido de ${username} para ${recipientUsername}: ${content}`);
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
       const recipientCheck = await db.query('SELECT id FROM users WHERE username = $1', [trimmedRecipient]);
       if (recipientCheck.rows.length === 0) {
          console.log(`Destinatario '${trimmedRecipient}' no encontrado.`);
          return socket.emit('messageError', { error: `Usuario '${trimmedRecipient}' no encontrado.` });
       }
       const recipientId = recipientCheck.rows[0].id;
       const recipientIdString = recipientId.toString();

       // 2. Guardar mensaje en DB (con recipient_id)
       const newMessage = await db.query(
         'INSERT INTO messages (content, sender_id, recipient_id) VALUES ($1, $2, $3) RETURNING id, content, sender_id, recipient_id, created_at',
         [trimmedContent, socket.user.userId, recipientId]
       );

       // 3. Preparar mensaje para emitir
       const messageToSend = {
         id: newMessage.rows[0].id,
         content: newMessage.rows[0].content,
         createdAt: newMessage.rows[0].created_at,
         sender: { id: socket.user.userId, username: username },
         recipient: { id: recipientId, username: trimmedRecipient }
       };

       // 4. Emitir a la sala del DESTINATARIO
       io.to(recipientIdString).emit('newMessage', messageToSend);
       console.log(`Mensaje emitido a la sala del destinatario: ${recipientIdString}`);

       // 5. Emitir a la sala del REMITENTE
       io.to(userIdString).emit('newMessage', messageToSend);
       console.log(`Mensaje emitido a la sala del remitente: ${userIdString}`);

       console.log(`Mensaje de ${username} para ${trimmedRecipient} procesado.`);

     } catch (dbError) {
        console.error(`Error DB/Socket al procesar mensaje de ${username} para ${trimmedRecipient}:`, dbError);
        socket.emit('messageError', { error: 'Error interno al enviar el mensaje.' });
     }
   });

   // Manejar desconexión
   socket.on('disconnect', (reason) => {
     console.log(`Cliente desconectado: ${socket.id}, Usuario: ${username}, Razón: ${reason}`);
   });
});


// -----------------------------------------------------------------------------
// 9. Definición de Rutas Express HTTP (API)
// -----------------------------------------------------------------------------
app.get('/', (req, res) => { res.send('API funcionando correctamente!'); });

// Ruta Registro
app.post('/api/auth/register', async (req, res) => {
  console.log('*** POST /api/auth/register - Handler ENTRY ***');
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  if (username.length < 3) return res.status(400).json({ message: 'El nombre de usuario debe tener al menos 3 caracteres' });
  console.log('Validaciones pasadas para registro.');
  try {
    const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) return res.status(409).json({ message: 'El nombre de usuario ya está en uso' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = await db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at', [username, passwordHash]);
    console.log('Usuario registrado exitosamente en DB:', newUser.rows[0]);
    res.status(201).json({ message: `Usuario ${newUser.rows[0].username} registrado exitosamente.`, user: newUser.rows[0] });
  } catch (err) { /* ... manejo error ... */ }
});

// Ruta Login
app.post('/api/auth/login', async (req, res) => {
  console.log('*** POST /api/auth/login - Handler ENTRY ***');
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  console.log('Validaciones pasadas para login.');
  try {
    const result = await db.query('SELECT id, username, password_hash, created_at FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) return res.status(401).json({ message: 'Credenciales inválidas' });
    console.log(`Login exitoso para usuario: ${user.username}. Generando token...`);
    const tokenPayload = { userId: user.id, username: user.username };
    const secret = process.env.JWT_SECRET;
    if (!secret) { /* ... manejo error ... */ }
    const options = { expiresIn: '1h' };
    const token = jwt.sign(tokenPayload, secret, options);
    res.status(200).json({ message: `Acceso concedido para ${user.username}`, token: token, user: { id: user.id, username: user.username, created_at: user.created_at } });
  } catch (err) { /* ... manejo error ... */ }
});

// Ruta Historial Mensajes (TODO: Proteger con authMiddleware)
app.get('/api/messages', /* authMiddleware, */ async (req, res) => {
    console.log(`Solicitud de historial de mensajes recibida.`);
    try {
       // Modificar consulta para filtrar mensajes relevantes si es necesario (ej. para el usuario actual)
       // Por ahora, devuelve todos (o los últimos 100 globales)
       const result = await db.query(`
          SELECT m.id, m.content, m.created_at AS "createdAt",
                 s.id AS sender_id, s.username AS sender_username,
                 r.id AS recipient_id, r.username AS recipient_username
          FROM messages m
          JOIN users s ON m.sender_id = s.id
          LEFT JOIN users r ON m.recipient_id = r.id -- LEFT JOIN para incluir mensajes sin destinatario (si los hubiera)
          ORDER BY m.created_at ASC
          LIMIT 100
       `);
       const messages = result.rows.map(row => ({
          id: row.id, content: row.content, createdAt: row.createdAt,
          sender: { id: row.sender_id, username: row.sender_username },
          // Incluye destinatario solo si existe
          recipient: row.recipient_id ? { id: row.recipient_id, username: row.recipient_username } : null
       }));
       res.status(200).json(messages);
    } catch (err) {
       console.error("Error al obtener mensajes:", err);
       res.status(500).json({ message: "Error al cargar el historial." });
    }
 });


// -----------------------------------------------------------------------------
// 10. Inicio del Servidor
// -----------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Servidor (HTTP + WebSocket) corriendo en http://localhost:${PORT}`);
  db.query('SELECT NOW()', (err, res) => {
    if (err) { console.error('\n*** ERROR AL VERIFICAR CONEXIÓN A DB ***\n', err); }
    else { console.log('Conexión a la base de datos verificada exitosamente a las:', res.rows[0].now); }
  });
});