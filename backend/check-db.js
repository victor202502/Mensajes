require('dotenv').config();
const { Client } = require('pg');

const client = new Client(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined
);

async function check() {
  try {
    await client.connect();
    console.log('\n🔍 COMPROBANDO LAS 3 FASES EN TU BASE DE DATOS...\n');

    // 1. Verificar tabla messages
    const r1 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'");
    const mCols = r1.rows.map(r => r.column_name);
    console.log('Fase 1: Columna read_at en messages       ->', mCols.includes('read_at') ? '✅ APLICADO' : '❌ FALTA');

    // 2. Verificar tabla contacts
    const r2 = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contacts')");
    console.log('Fase 2: Tabla contacts creada             ->', r2.rows[0].exists ? '✅ APLICADO' : '❌ FALTA');

    // 3. Verificar entregados y última vez visto
    console.log('Fase 3: Columna delivered_at en messages  ->', mCols.includes('delivered_at') ? '✅ APLICADO' : '❌ FALTA');
    
    const r3 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const uCols = r3.rows.map(r => r.column_name);
    console.log('Fase 3: Columna last_seen_at en users     ->', uCols.includes('last_seen_at') ? '✅ APLICADO\n' : '❌ FALTA\n');

  } catch (error) {
    console.error('❌ Error durante la comprobación:', error.message);
  } finally {
    await client.end();
  }
}

check();