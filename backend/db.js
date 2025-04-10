// backend/db.js
const { Pool } = require('pg');
require('dotenv').config(); // Asegura que las variables de .env estén disponibles

// Configuración de la conexión usando la variable de entorno DATABASE_URL
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

// IMPORTANTE: Añadir configuración SSL requerida por Render
// Solo aplica SSL en producción (cuando NODE_ENV es 'production')
// o si la URL de conexión incluye explícitamente Render (más seguro para desarrollo local)
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('render.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false // Necesario para conexiones a bases de datos gestionadas como las de Render/Heroku
  };
  console.log("Configuración SSL habilitada para la conexión a la base de datos.");
} else {
  console.log("Configuración SSL NO habilitada (entorno no producción o URL no Render).");
}


// Crear una instancia del Pool de conexiones
const pool = new Pool(poolConfig);

// Evento opcional para detectar errores en clientes inactivos del pool
pool.on('error', (err, client) => {
  console.error('Error inesperado en cliente inactivo del pool', err);
  process.exit(-1); // Considera salir si hay un error crítico en el pool
});

// Exportar un método para ejecutar consultas de forma sencilla
module.exports = {
  // Función asíncrona para ejecutar consultas SQL
  query: async (text, params) => {
    const start = Date.now();
    try {
        // Obtiene un cliente del pool, ejecuta la consulta y libera el cliente
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Puedes descomentar esto para depuración, muestra cada consulta ejecutada
        // console.log('Consulta ejecutada:', { text, params: params || [], duration: `${duration}ms`, rows: res.rowCount });
        return res;
    } catch (err) {
        // Si hay un error en la consulta, lo muestra y lo relanza
        console.error('Error ejecutando consulta:', { text, params: params || [] });
        console.error(err);
        throw err; // Relanza el error para que sea manejado por el llamador (en server.js)
    }
  },

  // También puedes exportar el pool si necesitas un control más avanzado (ej. transacciones)
  // pool: pool
};