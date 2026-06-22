// persistence-store.js
// ------------------------------------------------------------------
// Modulo EXPORTABLE de mas alto nivel: un "repositorio" generico
// para guardar/leer objetos en Redis con:
//   - serializacion JSON automatica
//   - TTL opcional (expiracion en segundos)
//   - prefijo/namespace para no mezclar claves
//
// Esto es lo que tu API (NestJS u otra) consumiria en produccion.
//
// Uso:
//   const { RedisStore } = require('./persistence-store');
//   const store = new RedisStore({ namespace: 'sii' });
//   await store.set('factura:123', { monto: 1000 }, 3600); // expira en 1h
//   const f = await store.get('factura:123');
// ------------------------------------------------------------------
const { getClient } = require('./redisClient');

class RedisStore {
  /**
   * @param {{ namespace?: string }} [opts]
   */
  constructor(opts = {}) {
    this.namespace = opts.namespace || 'app';
  }

  _key(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Guarda un valor (cualquier objeto serializable a JSON).
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlSeconds] expiracion opcional en segundos
   */
  async set(key, value, ttlSeconds) {
    const c = await getClient();
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await c.set(this._key(key), payload, { EX: ttlSeconds });
    } else {
      await c.set(this._key(key), payload);
    }
    return true;
  }

  /**
   * Lee y deserializa un valor. Devuelve null si no existe / expiro.
   * @param {string} key
   */
  async get(key) {
    const c = await getClient();
    const raw = await c.get(this._key(key));
    return raw === null ? null : JSON.parse(raw);
  }

  /** Elimina una clave. Devuelve cuantas borro (0 o 1). */
  async del(key) {
    const c = await getClient();
    return c.del(this._key(key));
  }

  /** ¿Existe la clave? */
  async has(key) {
    const c = await getClient();
    return (await c.exists(this._key(key))) === 1;
  }

  /** Segundos que le quedan de vida a la clave (-1 sin TTL, -2 no existe). */
  async ttl(key) {
    const c = await getClient();
    return c.ttl(this._key(key));
  }

  /** Lista las claves del namespace (usa SCAN, seguro en produccion). */
  async keys() {
    const c = await getClient();
    const found = [];
    // node-redis v6: scanIterator entrega LOTES (arrays) de claves, no una a una.
    for await (const batch of c.scanIterator({ MATCH: `${this.namespace}:*`, COUNT: 100 })) {
      found.push(...batch);
    }
    return found;
  }
}

module.exports = { RedisStore };
