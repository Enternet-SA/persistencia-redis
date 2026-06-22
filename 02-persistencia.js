// 02-persistencia.js
// ------------------------------------------------------------------
// Demuestra los modos de PERSISTENCIA de Redis y como dispararlos
// desde el cliente. Ejecuta:  node 02-persistencia.js
//
// Redis es una base de datos EN MEMORIA. Para no perder los datos al
// reiniciar ofrece 2 mecanismos (combinables):
//
//   RDB  (snapshots)  -> foto puntual del dataset a disco (dump.rdb).
//                        Rapido de cargar, compacto. Puede perder los
//                        datos escritos entre dos snapshots.
//
//   AOF  (append-only)-> log de cada comando de escritura (appendonly.aof).
//                        Mas duradero (perdida ~1s con fsync everysec),
//                        archivo mas grande, recuperacion mas lenta.
//
//   none              -> sin persistencia: solo cache en RAM volatil.
//   RDB + AOF         -> recomendado en produccion (lo mejor de ambos).
// ------------------------------------------------------------------
const { getClient, closeClient } = require('./redisClient');

async function show(c, param) {
  const v = await c.configGet(param);
  console.log(`  ${param.padEnd(14)} =`, v[param]);
}

async function main() {
  const c = await getClient();
  console.log('\n=== PERSISTENCIA EN REDIS ===\n');

  // --- 1. Inspeccionar la configuracion actual ---
  console.log('Configuracion actual:');
  await show(c, 'dir');          // carpeta donde se guardan los archivos
  await show(c, 'dbfilename');   // nombre del snapshot RDB (dump.rdb)
  await show(c, 'save');         // reglas RDB: "segundos cambios" (vacio = RDB off)
  await show(c, 'appendonly');   // yes/no -> AOF activado
  await show(c, 'appendfsync');  // always | everysec | no

  // --- 2. Escribir datos de prueba ---
  console.log('\nEscribiendo 1000 claves de prueba...');
  const pipe = c.multi();
  for (let i = 0; i < 1000; i++) pipe.set(`persist:test:${i}`, `valor-${i}`);
  await pipe.exec();
  console.log('  Hechas 1000 escrituras (estan en RAM).');

  // --- 3. Disparar un snapshot RDB manual ---
  // BGSAVE = en segundo plano (no bloquea). SAVE = bloqueante (no usar en prod).
  const before = await c.configGet('dir');
  console.log('\nForzando snapshot RDB con BGSAVE...');
  try {
    await c.bgSave();
    console.log('  BGSAVE lanzado. Se escribe dump.rdb en:', before.dir);
  } catch (e) {
    console.log('  BGSAVE no disponible:', e.message);
  }
  const lastSave = await c.sendCommand(['LASTSAVE']);
  console.log('  LASTSAVE (timestamp ultimo guardado RDB):', lastSave);

  // --- 4. Reescribir/compactar el AOF (si esta activo) ---
  const aof = await c.configGet('appendonly');
  if (aof.appendonly === 'yes') {
    console.log('\nAOF activo -> compactando con BGREWRITEAOF...');
    try {
      await c.sendCommand(['BGREWRITEAOF']);
      console.log('  AOF reescrito (compactado).');
    } catch (e) {
      console.log('  BGREWRITEAOF:', e.message);
    }
  } else {
    console.log('\nAOF NO activo. Para activarlo en caliente:');
    console.log('  redis-cli CONFIG SET appendonly yes');
  }

  // --- 5. Activar/desactivar persistencia desde el cliente (demo) ---
  console.log('\nEjemplo: cambiar reglas RDB en caliente (cada 60s si >=10 cambios):');
  console.log('  await c.configSet("save", "60 10")');
  // await c.configSet('save', '60 10'); // <- descomenta para aplicarlo

  console.log('\nPRUEBA REAL DE DURABILIDAD:');
  console.log('  1) Ejecuta este script.');
  console.log('  2) Reinicia Redis:  sudo service redis-server restart');
  console.log('  3) Vuelve a leer:   redis-cli get persist:test:500');
  console.log('     -> Si hay RDB/AOF, el valor SOBREVIVE al reinicio.\n');

  await closeClient();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
