// 03-store-demo.js
// ------------------------------------------------------------------
// Demo del modulo exportable RedisStore (lo que usaria tu API).
// Ejecuta:  node 03-store-demo.js
// ------------------------------------------------------------------
const { RedisStore } = require('./persistence-store');
const { closeClient } = require('./redisClient');

async function main() {
  const store = new RedisStore({ namespace: 'sii' });
  console.log('\n=== DEMO RedisStore (repositorio con JSON + TTL) ===\n');

  // Guardar un objeto (se serializa solo)
  await store.set('factura:1001', {
    folio: 1001,
    rutEmisor: '76.123.456-7',
    monto: 52000,
    items: ['servicio A', 'servicio B'],
  });

  // Guardar con expiracion (cache temporal de 30s)
  await store.set('sesion:user42', { user: 'cristobal', rol: 'admin' }, 30);

  // Leer (se deserializa solo)
  console.log('factura:1001 ->', await store.get('factura:1001'));
  console.log('sesion:user42 ->', await store.get('sesion:user42'));
  console.log('TTL sesion    ->', await store.ttl('sesion:user42'), 's');
  console.log('existe X?     ->', await store.has('factura:9999'));

  // Listar claves del namespace (SCAN, seguro)
  console.log('claves sii:*  ->', await store.keys());

  // Borrar
  await store.del('factura:1001');
  console.log('tras borrar   ->', await store.get('factura:1001'));

  console.log('\nLos objetos quedan en Redis. Reinicia el server y, si hay');
  console.log('persistencia activa, "sii:factura:*" seguira ahi.\n');

  await closeClient();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
