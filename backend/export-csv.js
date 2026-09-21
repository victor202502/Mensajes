require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined
);

// Función auxiliar para escapar correctamente caracteres especiales en CSV
function valueToCSV(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  let str = String(val);
  str = str.replace(/"/g, '""'); // Escapar comillas dobles
  return `"${str}"`;
}

async function exportToCSV() {
  try {
    await client.connect();
    console.log('\n📦 Conectando a la base de datos para exportar...');

    // 1. Obtener la lista de todas las tablas públicas creadas
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    
    // Crear la carpeta donde se guardarán los CSVs
    const exportDir = path.join(__dirname, 'db_exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    console.log(`\n📂 Se creará la carpeta: ${exportDir}`);

    // 2. Exportar cada tabla una por una
    for (const table of tables) {
      console.log(`⏳ Exportando tabla: "${table}"...`);
      const dataRes = await client.query(`SELECT * FROM "${table}"`);
      
      let csvContent = '';

      if (dataRes.rows.length === 0) {
        // Si la tabla está vacía, obtenemos al menos las cabeceras de sus columnas
        const colsRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${table}'
        `);
        const headers = colsRes.rows.map(r => r.column_name).join(',');
        csvContent = headers + '\n';
      } else {
        // Si tiene filas, tomamos las columnas del primer registro
        const headers = Object.keys(dataRes.rows[0]);
        csvContent = headers.join(',') + '\n';

        for (const row of dataRes.rows) {
          const line = headers.map(header => valueToCSV(row[header])).join(',');
          csvContent += line + '\n';
        }
      }

      // Guardar el archivo en formato UTF-8
      fs.writeFileSync(path.join(exportDir, `${table}.csv`), csvContent, 'utf8');
    }

    console.log(`\n✅ ¡Éxito! Los archivos CSV se han guardado correctamente en la carpeta "db_exports".\n`);

  } catch (error) {
    console.error('❌ Error al exportar:', error.message);
  } finally {
    await client.end();
  }
}

exportToCSV();