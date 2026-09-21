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

// <<< NEU (Phase 1): reines In-Memory-Modul für den Online-Status der Benutzer >>>
const presence = require('./presence');
// <<< NEU (Phase 4): Rollen-/Rechteprüfung für Gruppen >>>
const groupPermissions = require('./groupPermissions');

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

   // <<< NEU (Phase 1): Online-Präsenz registrieren und an alle Clients broadcasten >>>
   presence.markOnline(userId, socket.id);
   io.emit('userStatusChanged', { userId, isOnline: true });

   // <<< NEU (Phase 4): eigenen Gruppenräumen beitreten (IIFE, damit der restliche,
   //     synchrone Verbindungsaufbau unten nicht auf die DB-Antwort warten muss) >>>
   (async () => {
     try {
       const myGroups = await db.query('SELECT group_id FROM group_members WHERE user_id = $1', [userId]);
       myGroups.rows.forEach((row) => socket.join(`group_${row.group_id}`));
     } catch (err) {
       console.error(`Error al unir a ${username} a sus salas de grupo:`, err);
     }
   })();

   // Escuchar evento 'sendMessage' { recipientUsername, content }
   socket.on('sendMessage', async ({ recipientUsername, content, replyToId, forwardedFromUsername }) => {
     console.log(`Mensaje recibido de ${username} (ID: ${userId}) para ${recipientUsername}: ${content}`);
     const trimmedContent = content?.trim();
     const trimmedRecipient = recipientUsername?.trim();
     // <<< NEU (Phase 5): beide optional, unverändertes Verhalten wenn nicht gesetzt >>>
     const parsedReplyToIdRaw = parseInt(replyToId, 10);
     const parsedReplyToId = Number.isInteger(parsedReplyToIdRaw) ? parsedReplyToIdRaw : null;
     const trimmedForwardedFrom = typeof forwardedFromUsername === 'string' ? forwardedFromUsername.trim().slice(0, 50) || null : null;

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

       // <<< NEU (Phase 2): Nachrichten sind jetzt auf akzeptierte Kontakte beschränkt.
       //     Bestehende Konversationen wurden per Migration (002) automatisch als
       //     akzeptierte Kontakte übernommen, damit hier nichts Bestehendes bricht. >>>
       const contactCheck = await db.query(
         `SELECT status FROM contacts
          WHERE (requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1)`,
         [userId, recipientId]
       );
       if (contactCheck.rows.length === 0 || contactCheck.rows[0].status !== 'accepted') {
         console.log(`Nachricht von ${username} an ${trimmedRecipient} blockiert: keine akzeptierte Kontaktbeziehung.`);
         return socket.emit('messageError', { error: 'Ihr müsst Kontakte sein, um Nachrichten auszutauschen.' });
       }

       // 2. Guardar mensaje en DB (con recipient_id)
       // <<< NEU (Phase 5): reply_to_id/forwarded_from_username sind nullable,
       //     bestehende Aufrufe ohne diese Felder verhalten sich exakt wie zuvor >>>
       const newMessage = await db.query(
         `INSERT INTO messages (content, sender_id, recipient_id, reply_to_id, forwarded_from_username)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, content, sender_id, recipient_id, created_at, reply_to_id, forwarded_from_username`,
         [trimmedContent, userId, recipientId, parsedReplyToId, trimmedForwardedFrom]
       );

       // 3. Preparar mensaje para emitir (incluyendo info completa de sender/recipient)
       const messageToSend = {
         id: newMessage.rows[0].id,
         content: newMessage.rows[0].content,
         createdAt: newMessage.rows[0].created_at,
         // <<< NEU (Phase 3): gleiche Form wie die Nachrichten aus /api/messages >>>
         deliveredAt: null,
         readAt: null,
         // <<< NEU (Phase 5): gleiche Form wie /api/messages >>>
         editedAt: null,
         deletedAt: null,
         pinnedAt: null,
         replyToId: newMessage.rows[0].reply_to_id,
         forwardedFromUsername: newMessage.rows[0].forwarded_from_username,
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

   // <<< NEU (Phase 3): "Benutzer schreibt..." — leitet nur an akzeptierte Kontakte weiter >>>
   socket.on('typing', async ({ recipientId }) => {
     const targetId = parseInt(recipientId, 10);
     if (!Number.isInteger(targetId)) return;
     try {
       const contactCheck = await db.query(
         `SELECT 1 FROM contacts
          WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
            AND status = 'accepted'`,
         [userId, targetId]
       );
       if (contactCheck.rows.length > 0) {
         io.to(targetId.toString()).emit('partnerTyping', { userId });
       }
     } catch (err) {
       console.error(`Error al reenviar evento 'typing' de ${username} a ${targetId}:`, err);
     }
   });

   // <<< NEU (Phase 3): Zustellbestätigung — Empfänger-Client bestätigt den Erhalt einer Nachricht >>>
   socket.on('ackDelivered', async ({ messageId }) => {
     const id = parseInt(messageId, 10);
     if (!Number.isInteger(id)) return;
     try {
       const result = await db.query(
         `UPDATE messages SET delivered_at = NOW()
          WHERE id = $1 AND delivered_at IS NULL
          RETURNING sender_id`,
         [id]
       );
       if (result.rows.length > 0) {
         const senderId = result.rows[0].sender_id;
         io.to(senderId.toString()).emit('messageStatusUpdate', { messageId: id, status: 'delivered' });
       }
     } catch (err) {
       console.error(`Error al confirmar entrega del mensaje ${id}:`, err);
     }
   });

   // <<< NEU (Phase 4): Nachricht an eine Gruppe senden >>>
   socket.on('sendGroupMessage', async ({ groupId, content, replyToId, forwardedFromUsername }) => {
     const gId = parseInt(groupId, 10);
     const trimmedContent = content?.trim();
     const parsedReplyToIdRaw = parseInt(replyToId, 10);
     const parsedReplyToId = Number.isInteger(parsedReplyToIdRaw) ? parsedReplyToIdRaw : null;
     const trimmedForwardedFrom = typeof forwardedFromUsername === 'string' ? forwardedFromUsername.trim().slice(0, 50) || null : null;
     if (!Number.isInteger(gId) || !trimmedContent) {
       return socket.emit('messageError', { error: 'Ungültige Gruppennachricht.' });
     }
     try {
       const role = await groupPermissions.getMemberRole(gId, userId);
       if (!role) {
         return socket.emit('messageError', { error: 'Du bist kein Mitglied dieser Gruppe.' });
       }
       const inserted = await db.query(
         `INSERT INTO group_messages (group_id, sender_id, content, reply_to_id, forwarded_from_username)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, created_at, reply_to_id, forwarded_from_username`,
         [gId, userId, trimmedContent, parsedReplyToId, trimmedForwardedFrom]
       );
       const groupMessageToSend = {
         id: inserted.rows[0].id,
         groupId: gId,
         content: trimmedContent,
         createdAt: inserted.rows[0].created_at,
         editedAt: null,
         deletedAt: null,
         pinnedAt: null,
         replyToId: inserted.rows[0].reply_to_id,
         forwardedFromUsername: inserted.rows[0].forwarded_from_username,
         sender: { id: userId, username },
       };
       io.to(`group_${gId}`).emit('newGroupMessage', groupMessageToSend);
     } catch (err) {
       console.error(`Error al enviar mensaje de ${username} al grupo ${gId}:`, err);
       socket.emit('messageError', { error: 'Fehler beim Senden der Gruppennachricht.' });
     }
   });

   // <<< NEU (Phase 5): eigene 1:1-Nachricht bearbeiten >>>
   socket.on('editMessage', async ({ messageId, content }) => {
     const id = parseInt(messageId, 10);
     const trimmedContent = content?.trim();
     if (!Number.isInteger(id) || !trimmedContent) {
       return socket.emit('messageError', { error: 'Ungültige Bearbeitung.' });
     }
     try {
       const result = await db.query(
         `UPDATE messages SET content = $1, edited_at = NOW()
          WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL
          RETURNING id, content, edited_at, sender_id, recipient_id`,
         [trimmedContent, id, userId]
       );
       if (result.rows.length === 0) {
         return socket.emit('messageError', { error: 'Nachricht kann nicht bearbeitet werden.' });
       }
       const row = result.rows[0];
       const payload = { messageId: row.id, content: row.content, editedAt: row.edited_at };
       io.to(row.sender_id.toString()).emit('messageEdited', payload);
       io.to(row.recipient_id.toString()).emit('messageEdited', payload);
     } catch (err) {
       console.error(`Error al editar mensaje ${id} (Usuario ${userId}):`, err);
       socket.emit('messageError', { error: 'Fehler beim Bearbeiten der Nachricht.' });
     }
   });

   // <<< NEU (Phase 5): eigene 1:1-Nachricht löschen (weich) >>>
   socket.on('deleteMessage', async ({ messageId }) => {
     const id = parseInt(messageId, 10);
     if (!Number.isInteger(id)) {
       return socket.emit('messageError', { error: 'Ungültige Löschanfrage.' });
     }
     try {
       const result = await db.query(
         `UPDATE messages SET content = NULL, deleted_at = NOW()
          WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
          RETURNING id, sender_id, recipient_id`,
         [id, userId]
       );
       if (result.rows.length === 0) {
         return socket.emit('messageError', { error: 'Nachricht kann nicht gelöscht werden.' });
       }
       const row = result.rows[0];
       const payload = { messageId: row.id };
       io.to(row.sender_id.toString()).emit('messageDeleted', payload);
       io.to(row.recipient_id.toString()).emit('messageDeleted', payload);
     } catch (err) {
       console.error(`Error al eliminar mensaje ${id} (Usuario ${userId}):`, err);
       socket.emit('messageError', { error: 'Fehler beim Löschen der Nachricht.' });
     }
   });

   // <<< NEU (Phase 5): eigene Gruppennachricht bearbeiten >>>
   socket.on('editGroupMessage', async ({ messageId, content }) => {
     const id = parseInt(messageId, 10);
     const trimmedContent = content?.trim();
     if (!Number.isInteger(id) || !trimmedContent) {
       return socket.emit('messageError', { error: 'Ungültige Bearbeitung.' });
     }
     try {
       const result = await db.query(
         `UPDATE group_messages SET content = $1, edited_at = NOW()
          WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL
          RETURNING id, group_id, content, edited_at`,
         [trimmedContent, id, userId]
       );
       if (result.rows.length === 0) {
         return socket.emit('messageError', { error: 'Nachricht kann nicht bearbeitet werden.' });
       }
       const row = result.rows[0];
       io.to(`group_${row.group_id}`).emit('groupMessageEdited', {
         messageId: row.id, groupId: row.group_id, content: row.content, editedAt: row.edited_at,
       });
     } catch (err) {
       console.error(`Error al editar mensaje de grupo ${id} (Usuario ${userId}):`, err);
       socket.emit('messageError', { error: 'Fehler beim Bearbeiten der Nachricht.' });
     }
   });

   // <<< NEU (Phase 5): eigene Gruppennachricht löschen (weich) >>>
   socket.on('deleteGroupMessage', async ({ messageId }) => {
     const id = parseInt(messageId, 10);
     if (!Number.isInteger(id)) {
       return socket.emit('messageError', { error: 'Ungültige Löschanfrage.' });
     }
     try {
       const result = await db.query(
         `UPDATE group_messages SET content = NULL, deleted_at = NOW()
          WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
          RETURNING id, group_id`,
         [id, userId]
       );
       if (result.rows.length === 0) {
         return socket.emit('messageError', { error: 'Nachricht kann nicht gelöscht werden.' });
       }
       const row = result.rows[0];
       io.to(`group_${row.group_id}`).emit('groupMessageDeleted', { messageId: row.id, groupId: row.group_id });
     } catch (err) {
       console.error(`Error al eliminar mensaje de grupo ${id} (Usuario ${userId}):`, err);
       socket.emit('messageError', { error: 'Fehler beim Löschen der Nachricht.' });
     }
   });

   // Manejar desconexión
   socket.on('disconnect', async (reason) => {
     console.log(`Cliente desconectado: ${socket.id}, Usuario: ${username} (ID: ${userId}), Razón: ${reason}`);
     // No es necesario 'leave', al desconectar se sale automáticamente de las salas

     // <<< NEU (Phase 1): Online-Präsenz nur entfernen, wenn dies der letzte Socket
     //     dieses Benutzers war (mehrere Tabs/Geräte möglich) >>>
     const wentFullyOffline = presence.markOffline(userId, socket.id);
     if (wentFullyOffline) {
       io.emit('userStatusChanged', { userId, isOnline: false });
       // <<< NEU (Phase 3): "letzter Zugriff" nur aktualisieren, wenn wirklich offline >>>
       try {
         await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);
       } catch (err) {
         console.error(`Error al actualizar last_seen_at para Usuario ID ${userId}:`, err);
       }
     }
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
                 m.delivered_at AS "deliveredAt", m.read_at AS "readAt",
                 m.edited_at AS "editedAt", m.deleted_at AS "deletedAt",
                 m.reply_to_id AS "replyToId", m.forwarded_from_username AS "forwardedFromUsername",
                 m.pinned_at AS "pinnedAt",
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
          // <<< NEU (Phase 3): Zustellungs-/Lesestatus, rein additiv >>>
          deliveredAt: row.deliveredAt, readAt: row.readAt,
          // <<< NEU (Phase 5): rein additiv >>>
          editedAt: row.editedAt, deletedAt: row.deletedAt,
          replyToId: row.replyToId, forwardedFromUsername: row.forwardedFromUsername,
          pinnedAt: row.pinnedAt,
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
// 9b. NEU (Phase 1) — Rutas para die Konversationsliste
// Rein additiv: keine bestehende Route wird verändert oder entfernt.
// -----------------------------------------------------------------------------

// --- Ruta: estado online de todos los usuarios ---
app.get('/api/users/status', authMiddleware, async (req, res) => {
  try {
    const onlineUserIds = presence.getOnlineUserIds();
    res.status(200).json({ onlineUserIds });
  } catch (err) {
    console.error('Error al obtener el estado online:', err);
    res.status(500).json({ message: 'Fehler beim Abrufen des Online-Status.' });
  }
});

// --- Ruta: contador de mensajes sin leer, agrupado por remitente ---
app.get('/api/conversations/unread', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const result = await db.query(
      `SELECT sender_id, COUNT(*)::int AS unread_count
       FROM messages
       WHERE recipient_id = $1 AND read_at IS NULL
       GROUP BY sender_id`,
      [currentUserId]
    );
    const unreadCounts = result.rows.map((row) => ({
      partnerId: row.sender_id,
      unreadCount: row.unread_count,
    }));
    res.status(200).json(unreadCounts);
  } catch (err) {
    console.error(`Error al obtener contadores de no leídos para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen der ungelesenen Nachrichten.' });
  }
});

// --- Ruta: marcar como leídos todos los mensajes de un remitente concreto ---
app.post('/api/conversations/:partnerId/read', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const partnerId = parseInt(req.params.partnerId, 10);

  if (!Number.isInteger(partnerId)) {
    return res.status(400).json({ message: 'Ungültige partnerId.' });
  }

  try {
    const result = await db.query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [partnerId, currentUserId]
    );
    // <<< NEU (Phase 3): den Absender in Echtzeit informieren, dass seine Nachrichten gelesen wurden >>>
    if (result.rowCount > 0) {
      io.to(partnerId.toString()).emit('messagesRead', { readerId: currentUserId });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al marcar como leída la conversación con ${partnerId} para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Markieren der Konversation als gelesen.' });
  }
});


// -----------------------------------------------------------------------------
// 9c. NEU (Phase 2) — Kontakt-System
// Rein additiv: keine bestehende Route wird verändert oder entfernt.
// -----------------------------------------------------------------------------

// --- Ruta: resumen completo (contactos, solicitudes entrantes/salientes, bloqueados) ---
app.get('/api/contacts/overview', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const contactsResult = await db.query(
      `SELECT u.id, u.username, u.last_seen_at AS "lastSeenAt"
       FROM contacts c
       JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.addressee_id ELSE c.requester_id END
       WHERE (c.requester_id = $1 OR c.addressee_id = $1) AND c.status = 'accepted'
       ORDER BY u.username ASC`,
      [currentUserId]
    );
    const incomingResult = await db.query(
      `SELECT u.id, u.username
       FROM contacts c
       JOIN users u ON u.id = c.requester_id
       WHERE c.addressee_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [currentUserId]
    );
    const outgoingResult = await db.query(
      `SELECT u.id, u.username
       FROM contacts c
       JOIN users u ON u.id = c.addressee_id
       WHERE c.requester_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [currentUserId]
    );
    const blockedResult = await db.query(
      `SELECT u.id, u.username
       FROM contacts c
       JOIN users u ON u.id = c.addressee_id
       WHERE c.requester_id = $1 AND c.status = 'blocked'
       ORDER BY u.username ASC`,
      [currentUserId]
    );
    // <<< NEU (Phase 3): Online-Status direkt an jeden Kontakt anhängen >>>
    const contactsWithStatus = contactsResult.rows.map((row) => ({
      ...row,
      isOnline: presence.isOnline(row.id),
    }));
    res.status(200).json({
      contacts: contactsWithStatus,
      incoming: incomingResult.rows,
      outgoing: outgoingResult.rows,
      blocked: blockedResult.rows,
    });
  } catch (err) {
    console.error(`Error al obtener resumen de contactos para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen der Kontakte.' });
  }
});

// --- Ruta: enviar solicitud de contacto ---
app.post('/api/contacts/request', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const addresseeId = parseInt(req.body?.addresseeId, 10);

  if (!Number.isInteger(addresseeId)) {
    return res.status(400).json({ message: 'Ungültige addresseeId.' });
  }
  if (addresseeId === currentUserId) {
    return res.status(400).json({ message: 'Du kannst dir nicht selbst eine Anfrage senden.' });
  }

  try {
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [addresseeId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }

    const existing = await db.query(
      `SELECT status FROM contacts
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [currentUserId, addresseeId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Es besteht bereits eine Beziehung zu diesem Benutzer.' });
    }

    await db.query(
      `INSERT INTO contacts (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
      [currentUserId, addresseeId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(`Error al enviar solicitud de ${currentUserId} a ${addresseeId}:`, err);
    res.status(500).json({ message: 'Fehler beim Senden der Kontaktanfrage.' });
  }
});

// --- Ruta: aceptar una solicitud recibida ---
app.post('/api/contacts/:userId/accept', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  try {
    const result = await db.query(
      `UPDATE contacts SET status = 'accepted', updated_at = NOW()
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [otherUserId, currentUserId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Keine offene Anfrage von diesem Benutzer gefunden.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al aceptar solicitud de ${otherUserId} para ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Annehmen der Anfrage.' });
  }
});

// --- Ruta: rechazar una solicitud recibida ---
app.post('/api/contacts/:userId/reject', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  try {
    const result = await db.query(
      `DELETE FROM contacts WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [otherUserId, currentUserId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Keine offene Anfrage von diesem Benutzer gefunden.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al rechazar solicitud de ${otherUserId} para ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Ablehnen der Anfrage.' });
  }
});

// --- Ruta: cancelar una solicitud que YO envié ---
app.post('/api/contacts/:userId/cancel', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  try {
    const result = await db.query(
      `DELETE FROM contacts WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [currentUserId, otherUserId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Keine gesendete Anfrage an diesen Benutzer gefunden.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al cancelar solicitud de ${currentUserId} a ${otherUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Zurückziehen der Anfrage.' });
  }
});

// --- Ruta: eliminar un contacto ya aceptado ---
app.delete('/api/contacts/:userId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  try {
    const result = await db.query(
      `DELETE FROM contacts
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [currentUserId, otherUserId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Kein bestehender Kontakt mit diesem Benutzer gefunden.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al eliminar contacto entre ${currentUserId} y ${otherUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Entfernen des Kontakts.' });
  }
});

// --- Ruta: bloquear a un usuario (sustituye cualquier relación previa) ---
app.post('/api/contacts/:userId/block', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  if (otherUserId === currentUserId) {
    return res.status(400).json({ message: 'Du kannst dich nicht selbst blockieren.' });
  }
  try {
    await db.query(
      `DELETE FROM contacts
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [currentUserId, otherUserId]
    );
    await db.query(
      `INSERT INTO contacts (requester_id, addressee_id, status) VALUES ($1, $2, 'blocked')`,
      [currentUserId, otherUserId]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al bloquear a ${otherUserId} desde ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Blockieren des Benutzers.' });
  }
});

// --- Ruta: desbloquear a un usuario ---
app.post('/api/contacts/:userId/unblock', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(otherUserId)) {
    return res.status(400).json({ message: 'Ungültige userId.' });
  }
  try {
    const result = await db.query(
      `DELETE FROM contacts WHERE requester_id = $1 AND addressee_id = $2 AND status = 'blocked'`,
      [currentUserId, otherUserId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Dieser Benutzer ist nicht blockiert.' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al desbloquear a ${otherUserId} desde ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Entsperren des Benutzers.' });
  }
});


// -----------------------------------------------------------------------------
// 9d. NEU (Phase 4) — Gruppen-System
// Rein additiv: keine bestehende Route wird verändert oder entfernt.
// Gruppen-Nachrichten leben bewusst in einer eigenen Tabelle (group_messages),
// getrennt von messages — siehe migrations/004_create_groups.sql.
// -----------------------------------------------------------------------------

// --- Ruta: meine Gruppen (mit Rolle und Mitgliederzahl) ---
app.get('/api/groups', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const result = await db.query(
      `SELECT g.id, g.name, g.description, g.avatar_emoji AS "avatarEmoji",
              gm.role,
              (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id) AS "memberCount"
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
       ORDER BY g.name ASC`,
      [currentUserId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(`Error al obtener grupos de Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen der Gruppen.' });
  }
});

// <<< FIX (verificación externa, punto 1) — REIHENFOLGE WICHTIG: Express prüft
//     Routen in Registrierungsreihenfolge. Diese beiden Routen MÜSSEN vor
//     GET /api/groups/:groupId stehen — sonst fängt :groupId Anfragen wie
//     "/api/groups/messages" ab und behandelt "messages" fälschlich als
//     groupId (führt zu 400 "Ungültige groupId", die eigentliche Route wurde
//     nie erreicht). Bitte beim Hinzufügen weiterer /api/groups/<literal>-
//     Routen IMMER vor :groupId einfügen. >>>

// --- Ruta: gesamter Nachrichtenverlauf aller eigenen Gruppen (analog zu /api/messages) ---
app.get('/api/groups/messages', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const result = await db.query(
      `SELECT gm.id, gm.group_id AS "groupId", gm.content, gm.created_at AS "createdAt",
              gm.edited_at AS "editedAt", gm.deleted_at AS "deletedAt",
              gm.reply_to_id AS "replyToId", gm.forwarded_from_username AS "forwardedFromUsername",
              gm.pinned_at AS "pinnedAt",
              u.id AS sender_id, u.username AS sender_username
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
       WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       ORDER BY gm.created_at ASC`,
      [currentUserId]
    );
    const messages = result.rows.map((row) => ({
      id: row.id,
      groupId: row.groupId,
      content: row.content,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
      replyToId: row.replyToId,
      forwardedFromUsername: row.forwardedFromUsername,
      pinnedAt: row.pinnedAt,
      sender: { id: row.sender_id, username: row.sender_username },
    }));
    res.status(200).json(messages);
  } catch (err) {
    console.error(`Error al obtener mensajes de grupo para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Laden der Gruppennachrichten.' });
  }
});

// --- Ruta: meine "zuletzt gelesen"-Zeiger für alle Gruppen ---
app.get('/api/groups/read-state', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const result = await db.query(
      `SELECT group_id AS "groupId", last_read_at AS "lastReadAt" FROM group_read_state WHERE user_id = $1`,
      [currentUserId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(`Error al obtener estado de lectura de grupos para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen des Lesestatus.' });
  }
});

// --- Ruta: Detail einer Gruppe inkl. Mitgliederliste mit Rollen ---
app.get('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ message: 'Ungültige groupId.' });
  }
  try {
    const myRole = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!myRole) {
      return res.status(403).json({ message: 'Du bist kein Mitglied dieser Gruppe.' });
    }
    const groupResult = await db.query(
      `SELECT id, name, description, avatar_emoji AS "avatarEmoji", created_by AS "createdBy"
       FROM groups WHERE id = $1`,
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: 'Gruppe nicht gefunden.' });
    }
    const membersResult = await db.query(
      `SELECT u.id, u.username, gm.role
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, u.username ASC`,
      [groupId]
    );
    res.status(200).json({
      ...groupResult.rows[0],
      myRole,
      members: membersResult.rows,
    });
  } catch (err) {
    console.error(`Error al obtener detalle del grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen der Gruppe.' });
  }
});

// --- Ruta: Gruppe erstellen ---
app.post('/api/groups', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const name = req.body?.name?.trim();
  const description = req.body?.description?.trim() || null;
  const avatarEmoji = req.body?.avatarEmoji || null;
  // FIX (verificación externa, punto 2): antes se aplicaba Number.isInteger()
  // directamente sobre los valores recibidos, lo que descarta en silencio
  // cualquier ID que llegue como string numérico (p. ej. "5"). Ahora se
  // convierte primero con parseInt y solo después se valida el resultado.
  const memberIds = Array.isArray(req.body?.memberIds)
    ? req.body.memberIds.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id))
    : [];

  if (!name || name.length < 2) {
    return res.status(400).json({ message: 'Der Gruppenname muss mindestens 2 Zeichen lang sein.' });
  }

  try {
    // <<< FIX (Phase 4 Debug) — Punkt 7 der Analyse (Transaktionen/Commit/
    //     Rollback): Gruppe + Owner-Mitgliedschaft + initiale Mitglieder liefen
    //     bisher als drei getrennte, nacheinander awaitete Anfragen OHNE
    //     gemeinsame Transaktion. Schlug eine davon fehl (z. B. ein einzelnes
    //     Mitglied), blieben Gruppe und Owner trotzdem in der DB stehen, obwohl
    //     der Client einen 500er sah — ein inkonsistenter Zwischenzustand.
    //     Jetzt läuft alles atomar: entweder alles zusammen oder gar nichts. >>>
    const insertedMemberIds = [];
    const groupId = await db.withTransaction(async (txDb) => {
      const groupResult = await txDb.query(
        `INSERT INTO groups (name, description, avatar_emoji, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, description, avatarEmoji, currentUserId]
      );
      const newGroupId = groupResult.rows[0].id;

      await txDb.query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [newGroupId, currentUserId]
      );

      // Nur Kontakte des Erstellers dürfen initial hinzugefügt werden (gleiche
      // Vertrauensgrenze wie beim späteren Einladen, siehe unten).
      for (const memberId of memberIds) {
        if (memberId === currentUserId) continue;
        const contactCheck = await txDb.query(
          `SELECT 1 FROM contacts WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)) AND status = 'accepted'`,
          [currentUserId, memberId]
        );
        if (contactCheck.rows.length > 0) {
          await txDb.query(
            `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [newGroupId, memberId]
          );
          insertedMemberIds.push(memberId);
        }
      }
      return newGroupId;
    });

    // Socket-Räume erst NACH erfolgreichem Commit beitreten lassen (sonst
    // könnten Räume für eine Gruppe vergeben werden, die durch einen
    // Rollback am Ende doch nicht existiert).
    io.in(currentUserId.toString()).socketsJoin(`group_${groupId}`);
    insertedMemberIds.forEach((memberId) => {
      io.in(memberId.toString()).socketsJoin(`group_${groupId}`);
    });
    // FIX (verificación externa, punto 3): fehlte bisher — ohne dieses Event
    // sahen frisch eingeladene Mitglieder die neue Gruppe erst nach einem
    // manuellen Neuladen. Jetzt identisch zum Verhalten von
    // POST /api/groups/:groupId/members (Einladen NACH der Erstellung).
    io.to(`group_${groupId}`).emit('groupUpdated', { groupId });

    res.status(201).json({ id: groupId });
  } catch (err) {
    console.error(`Error al crear grupo para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Erstellen der Gruppe.' });
  }
});

// --- Ruta: Gruppe bearbeiten (Name/Beschreibung/Avatar) ---
app.patch('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ message: 'Ungültige groupId.' });
  }
  try {
    const role = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.canManageGroup(role)) {
      return res.status(403).json({ message: 'Keine Berechtigung, diese Gruppe zu bearbeiten.' });
    }
    const name = req.body?.name?.trim();
    const description = req.body?.description?.trim();
    const avatarEmoji = req.body?.avatarEmoji;

    await db.query(
      `UPDATE groups SET
         name = COALESCE(NULLIF($1, ''), name),
         description = COALESCE($2, description),
         avatar_emoji = COALESCE($3, avatar_emoji),
         updated_at = NOW()
       WHERE id = $4`,
      [name, description, avatarEmoji, groupId]
    );
    io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al editar grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Bearbeiten der Gruppe.' });
  }
});

// --- Ruta: Gruppe löschen (nur Owner) ---
app.delete('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ message: 'Ungültige groupId.' });
  }
  try {
    const role = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.isOwner(role)) {
      return res.status(403).json({ message: 'Nur der Owner kann die Gruppe löschen.' });
    }
    await db.query('DELETE FROM groups WHERE id = $1', [groupId]); // CASCADE räumt members/messages/read_state mit auf
    io.to(`group_${groupId}`).emit('groupDeleted', { groupId });
    io.socketsLeave(`group_${groupId}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al eliminar grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Löschen der Gruppe.' });
  }
});

// --- Ruta: Mitglied hinzufügen/einladen (nur eigene Kontakte) ---
app.post('/api/groups/:groupId/members', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  const newMemberId = parseInt(req.body?.userId, 10);
  if (!Number.isInteger(groupId) || !Number.isInteger(newMemberId)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  try {
    const role = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.canManageGroup(role)) {
      return res.status(403).json({ message: 'Keine Berechtigung, Mitglieder einzuladen.' });
    }
    const contactCheck = await db.query(
      `SELECT 1 FROM contacts WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)) AND status = 'accepted'`,
      [currentUserId, newMemberId]
    );
    if (contactCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Du kannst nur eigene Kontakte einladen.' });
    }
    await db.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [groupId, newMemberId]
    );
    io.in(newMemberId.toString()).socketsJoin(`group_${groupId}`);
    io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(`Error al añadir miembro ${newMemberId} al grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Einladen des Mitglieds.' });
  }
});

// --- Ruta: Mitglied entfernen (kicken) ---
app.delete('/api/groups/:groupId/members/:userId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  const targetUserId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(groupId) || !Number.isInteger(targetUserId)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  try {
    const actorRole = await groupPermissions.getMemberRole(groupId, currentUserId);
    const targetRole = await groupPermissions.getMemberRole(groupId, targetUserId);
    if (!targetRole) {
      return res.status(404).json({ message: 'Dieser Benutzer ist kein Mitglied der Gruppe.' });
    }
    if (!groupPermissions.canKick(actorRole, targetRole)) {
      return res.status(403).json({ message: 'Keine Berechtigung, dieses Mitglied zu entfernen.' });
    }
    await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, targetUserId]);
    io.in(targetUserId.toString()).socketsLeave(`group_${groupId}`);
    io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    io.in(targetUserId.toString()).emit('groupUpdated', { groupId, removed: true });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al expulsar a ${targetUserId} del grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Entfernen des Mitglieds.' });
  }
});

// --- Ruta: Gruppe verlassen ---
app.post('/api/groups/:groupId/leave', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ message: 'Ungültige groupId.' });
  }
  try {
    const myRole = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!myRole) {
      return res.status(404).json({ message: 'Du bist kein Mitglied dieser Gruppe.' });
    }

    await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, currentUserId]);
    io.in(currentUserId.toString()).socketsLeave(`group_${groupId}`);

    const remaining = await db.query('SELECT user_id, role FROM group_members WHERE group_id = $1', [groupId]);

    if (remaining.rows.length === 0) {
      // Letztes Mitglied verlässt die Gruppe -> aufräumen
      await db.query('DELETE FROM groups WHERE id = $1', [groupId]);
      io.socketsLeave(`group_${groupId}`);
    } else if (myRole === 'owner') {
      // <<< Design-Entscheidung: beim Verlassen des Owners übernimmt automatisch
      //     das dienstälteste Mitglied (bevorzugt ein Moderator) die Rolle 'owner',
      //     damit keine Gruppe ohne Owner zurückbleibt. >>>
      const nextOwner = remaining.rows.find((m) => m.role === 'moderator') || remaining.rows[0];
      await db.query(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, [groupId, nextOwner.user_id]);
      io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    } else {
      io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al abandonar grupo ${groupId} (Usuario ${currentUserId}):`, err);
    res.status(500).json({ message: 'Fehler beim Verlassen der Gruppe.' });
  }
});

// --- Ruta: Rolle eines Mitglieds ändern (befördern/degradieren, nur Owner) ---
app.patch('/api/groups/:groupId/members/:userId/role', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  const targetUserId = parseInt(req.params.userId, 10);
  const newRole = req.body?.role;
  if (!Number.isInteger(groupId) || !Number.isInteger(targetUserId)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  if (newRole !== 'moderator' && newRole !== 'member') {
    return res.status(400).json({ message: "Rolle muss 'moderator' oder 'member' sein." });
  }
  try {
    const actorRole = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.isOwner(actorRole)) {
      return res.status(403).json({ message: 'Nur der Owner kann Rollen ändern.' });
    }
    const targetRole = await groupPermissions.getMemberRole(groupId, targetUserId);
    if (!targetRole || targetRole === 'owner') {
      return res.status(400).json({ message: 'Ungültiges Zielmitglied.' });
    }
    await db.query('UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3', [newRole, groupId, targetUserId]);
    io.to(`group_${groupId}`).emit('groupUpdated', { groupId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al cambiar rol de ${targetUserId} en grupo ${groupId}:`, err);
    res.status(500).json({ message: 'Fehler beim Ändern der Rolle.' });
  }
});

// --- Ruta: eine Gruppe als gelesen markieren ---
app.post('/api/groups/:groupId/read', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ message: 'Ungültige groupId.' });
  }
  try {
    await db.query(
      `INSERT INTO group_read_state (group_id, user_id, last_read_at) VALUES ($1, $2, NOW())
       ON CONFLICT (group_id, user_id) DO UPDATE SET last_read_at = NOW()`,
      [groupId, currentUserId]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al marcar grupo ${groupId} como leído para Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Markieren der Gruppe als gelesen.' });
  }
});




// -----------------------------------------------------------------------------
// 9e. NEU (Phase 5) -- Nachrichten anheften und Favoriten
// Rein additiv: keine bestehende Route wird veraendert oder entfernt.
// -----------------------------------------------------------------------------

app.post('/api/messages/:messageId/pin', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Ungueltige messageId.' });
  }
  try {
    const result = await db.query(
      `UPDATE messages SET pinned_at = NOW()
       WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2) AND deleted_at IS NULL
       RETURNING id, sender_id, recipient_id, pinned_at`,
      [messageId, currentUserId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Nachricht nicht gefunden.' });
    }
    const row = result.rows[0];
    const payload = { messageId: row.id, pinnedAt: row.pinned_at };
    io.to(row.sender_id.toString()).emit('messagePinned', payload);
    io.to(row.recipient_id.toString()).emit('messagePinned', payload);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al fijar mensaje ${messageId} (Usuario ${currentUserId}):`, err);
    res.status(500).json({ message: 'Fehler beim Anheften der Nachricht.' });
  }
});

app.post('/api/messages/:messageId/unpin', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Ungueltige messageId.' });
  }
  try {
    const result = await db.query(
      `UPDATE messages SET pinned_at = NULL
       WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)
       RETURNING id, sender_id, recipient_id`,
      [messageId, currentUserId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Nachricht nicht gefunden.' });
    }
    const row = result.rows[0];
    const payload = { messageId: row.id };
    io.to(row.sender_id.toString()).emit('messageUnpinned', payload);
    io.to(row.recipient_id.toString()).emit('messageUnpinned', payload);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al desfijar mensaje ${messageId} (Usuario ${currentUserId}):`, err);
    res.status(500).json({ message: 'Fehler beim Loesen der Nachricht.' });
  }
});

app.post('/api/groups/:groupId/messages/:messageId/pin', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isInteger(groupId) || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Ungueltige ID.' });
  }
  try {
    const role = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.canManageGroup(role)) {
      return res.status(403).json({ message: 'Keine Berechtigung, Nachrichten anzuheften.' });
    }
    const result = await db.query(
      `UPDATE group_messages SET pinned_at = NOW()
       WHERE id = $1 AND group_id = $2 AND deleted_at IS NULL
       RETURNING id, pinned_at`,
      [messageId, groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Nachricht nicht gefunden.' });
    }
    io.to(`group_${groupId}`).emit('groupMessagePinned', { messageId, groupId, pinnedAt: result.rows[0].pinned_at });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al fijar mensaje de grupo ${messageId} (grupo ${groupId}):`, err);
    res.status(500).json({ message: 'Fehler beim Anheften der Nachricht.' });
  }
});

app.post('/api/groups/:groupId/messages/:messageId/unpin', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId, 10);
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isInteger(groupId) || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: 'Ungueltige ID.' });
  }
  try {
    const role = await groupPermissions.getMemberRole(groupId, currentUserId);
    if (!groupPermissions.canManageGroup(role)) {
      return res.status(403).json({ message: 'Keine Berechtigung, Nachrichten zu loesen.' });
    }
    const result = await db.query(
      `UPDATE group_messages SET pinned_at = NULL WHERE id = $1 AND group_id = $2 RETURNING id`,
      [messageId, groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Nachricht nicht gefunden.' });
    }
    io.to(`group_${groupId}`).emit('groupMessageUnpinned', { messageId, groupId });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al desfijar mensaje de grupo ${messageId} (grupo ${groupId}):`, err);
    res.status(500).json({ message: 'Fehler beim Loesen der Nachricht.' });
  }
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  try {
    const result = await db.query(
      `SELECT message_type AS "messageType", message_id AS "messageId" FROM message_favorites WHERE user_id = $1`,
      [currentUserId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(`Error al obtener favoritos de Usuario ID ${currentUserId}:`, err);
    res.status(500).json({ message: 'Fehler beim Abrufen der Favoriten.' });
  }
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const messageType = req.body?.messageType;
  const messageId = parseInt(req.body?.messageId, 10);
  if ((messageType !== 'direct' && messageType !== 'group') || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: "messageType muss 'direct' oder 'group' sein, messageId muss gueltig sein." });
  }
  try {
    await db.query(
      `INSERT INTO message_favorites (user_id, message_type, message_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, message_type, message_id) DO NOTHING`,
      [currentUserId, messageType, messageId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(`Error al anadir favorito (Usuario ${currentUserId}):`, err);
    res.status(500).json({ message: 'Fehler beim Hinzufuegen zu den Favoriten.' });
  }
});

app.delete('/api/favorites/:messageType/:messageId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const messageType = req.params.messageType;
  const messageId = parseInt(req.params.messageId, 10);
  if ((messageType !== 'direct' && messageType !== 'group') || !Number.isInteger(messageId)) {
    return res.status(400).json({ message: "Ungueltiger messageType oder messageId." });
  }
  try {
    await db.query(
      `DELETE FROM message_favorites WHERE user_id = $1 AND message_type = $2 AND message_id = $3`,
      [currentUserId, messageType, messageId]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(`Error al eliminar favorito (Usuario ${currentUserId}):`, err);
    res.status(500).json({ message: 'Fehler beim Entfernen aus den Favoriten.' });
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