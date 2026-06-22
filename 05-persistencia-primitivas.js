// 05-persistencia-primitivas.js
// ------------------------------------------------------------------
// Demo de las 3 primitivas: PersistenciaSet / Get / Check.
// Ejecuta:  node 05-persistencia-primitivas.js
// ------------------------------------------------------------------
const { PersistenciaSet, PersistenciaGet, PersistenciaCheck } = require('./persistencia');
const { closeClient } = require('./redisClient');

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n=== PRIMITIVAS PersistenciaSet / Get / Check ===\n');

  const repo = 'sii/recibidos';
  const llave = 'DTE-33-1001';

  // SET
  const ok = await PersistenciaSet(repo, llave, '<DTE folio="1001">...</DTE>');
  console.log('PersistenciaSet ->', ok);

  // GET
  console.log('PersistenciaGet ->', await PersistenciaGet(repo, llave));

  // CHECK de algo que existe
  const c1 = await PersistenciaCheck(repo, llave);
  console.log('PersistenciaCheck (existe) ->', {
    ok: c1.ok,
    ultimaModificacion: c1.ultimaModificacion?.toISOString(),
  });

  // Modificar y comprobar que el mtime avanza
  await esperar(1100);
  await PersistenciaSet(repo, llave, '<DTE folio="1001" v="2">...</DTE>');
  const c2 = await PersistenciaCheck(repo, llave);
  console.log('PersistenciaCheck (tras re-escribir) ->', {
    ok: c2.ok,
    ultimaModificacion: c2.ultimaModificacion?.toISOString(),
  });
  console.log('  -> mtime avanzo:', c2.ultimaModificacion > c1.ultimaModificacion);

  // CHECK de algo que NO existe
  const c3 = await PersistenciaCheck(repo, 'NO-EXISTE');
  console.log('PersistenciaCheck (no existe) ->', c3);

  // GET de algo que no existe -> null
  console.log('PersistenciaGet (no existe) ->', await PersistenciaGet(repo, 'NO-EXISTE'));

  // Funciona con objetos, no solo texto
  await PersistenciaSet('config', 'descarga', { dias: 30, carpeta: 'C:/DESCARGAS' });
  console.log('\nObjeto Get ->', await PersistenciaGet('config', 'descarga'));

  await closeClient();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
