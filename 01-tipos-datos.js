// 01-tipos-datos.js
// ------------------------------------------------------------------
// Recorrido por las estructuras de datos de Redis (lo que guarda
// "en memoria"). Ejecuta:  node 01-tipos-datos.js
// ------------------------------------------------------------------
const { getClient, closeClient } = require('./redisClient');

async function main() {
  const c = await getClient();
  console.log('\n=== TIPOS DE DATOS EN REDIS ===\n');

  // 1) STRING: el tipo basico. Cache, contadores, flags, JSON serializado.
  await c.set('demo:nombre', 'Cristobal');
  console.log('STRING  ->', await c.get('demo:nombre'));

  // STRING como contador atomico
  await c.set('demo:visitas', 0);
  await c.incr('demo:visitas');
  await c.incrBy('demo:visitas', 10);
  console.log('COUNTER ->', await c.get('demo:visitas'));

  // TTL: expiracion automatica (clave volatil)
  await c.set('demo:token', 'abc123', { EX: 60 }); // expira en 60s
  console.log('TTL     -> quedan', await c.ttl('demo:token'), 'segundos');

  // 2) HASH: objeto con campos. Ideal para entidades (factura, usuario).
  await c.hSet('demo:factura:1', { folio: '1001', monto: '52000', estado: 'pagada' });
  console.log('HASH    ->', await c.hGetAll('demo:factura:1'));

  // 3) LIST: cola/pila ordenada. Colas de trabajo, ultimas N acciones.
  await c.del('demo:cola');
  await c.rPush('demo:cola', ['tarea-A', 'tarea-B', 'tarea-C']);
  console.log('LIST    ->', await c.lRange('demo:cola', 0, -1));
  console.log('LIST pop->', await c.lPop('demo:cola'), '(FIFO)');

  // 4) SET: conjunto sin duplicados. Etiquetas, IDs unicos.
  await c.del('demo:tags');
  await c.sAdd('demo:tags', ['sii', 'sii', 'factura', 'recibido']);
  console.log('SET     ->', await c.sMembers('demo:tags'), '(sin duplicados)');

  // 5) SORTED SET: conjunto ordenado por score. Rankings, colas por prioridad.
  await c.del('demo:ranking');
  await c.zAdd('demo:ranking', [
    { score: 100, value: 'empresa-A' },
    { score: 250, value: 'empresa-B' },
    { score: 175, value: 'empresa-C' },
  ]);
  const ranking = await c.zRangeWithScores('demo:ranking', 0, -1, { REV: true });
  console.log('ZSET    ->', ranking);

  console.log('\nTodo esto vive EN MEMORIA RAM. La persistencia (RDB/AOF)');
  console.log('decide que pasa al reiniciar Redis -> ver 02-persistencia.js\n');

  await closeClient();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
