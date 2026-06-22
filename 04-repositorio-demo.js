// 04-repositorio-demo.js
// ------------------------------------------------------------------
// Demuestra la interfaz estilo "repositorio" sobre Redis.
// Ejecuta:  node 04-repositorio-demo.js
// ------------------------------------------------------------------
const repo = require('./repositorioRedis');
const { closeClient } = require('./redisClient');

async function main() {
  console.log('\n=== INTERFAZ REPOSITORIO sobre Redis ===\n');

  // Mismo nombre de llave en DOS repositorios distintos: no colisionan.
  await repo.guardar('config', 'descargas/sii', { ruta: 'C:/DESCARGAS', dias: 30 });
  await repo.guardar('config', 'envios/sii', { servidor: 'palena.sii.cl', reintentos: 3 });

  console.log("obtener('config', 'descargas/sii') ->", await repo.obtener('config', 'descargas/sii'));
  console.log("obtener('config', 'envios/sii')    ->", await repo.obtener('config', 'envios/sii'));

  // Guardar varios documentos en un repositorio (como archivos en una carpeta)
  await repo.guardar('DTE-33-1001', 'sii/recibidos', '<DTE>...xml...</DTE>');
  await repo.guardar('DTE-33-1002', 'sii/recibidos', '<DTE>...xml...</DTE>');
  await repo.guardar('DTE-61-2001', 'sii/recibidos', '<DTE>...xml...</DTE>');

  // Listar el contenido del repositorio (como listar la carpeta)
  console.log("\nlistar('sii/recibidos') ->", await repo.listar('sii/recibidos'));

  // Existencia y borrado puntual
  console.log("existe('DTE-33-1001', ...) ->", await repo.existe('DTE-33-1001', 'sii/recibidos'));
  await repo.eliminar('DTE-33-1001', 'sii/recibidos');
  console.log("tras eliminar              ->", await repo.obtener('DTE-33-1001', 'sii/recibidos'));

  // Valor inexistente -> null (no lanza error)
  console.log("obtener llave inexistente  ->", await repo.obtener('no-existe', 'sii/recibidos'));

  // Guardar con expiracion opcional (ej: token temporal de 60s)
  await repo.guardar('token-sii', 'sesiones', 'abc123', { ttlSegundos: 60 });
  console.log("token con TTL              ->", await repo.obtener('token-sii', 'sesiones'));

  // Limpieza del repositorio de prueba (como vaciar la carpeta)
  const n = await repo.eliminarRepositorio('sii/recibidos');
  console.log(`\neliminarRepositorio('sii/recibidos') -> ${n} llaves borradas`);

  await closeClient();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
