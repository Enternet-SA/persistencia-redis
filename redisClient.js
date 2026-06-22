// redisClient.js
// ------------------------------------------------------------------
// Modulo EXPORTABLE: cliente Redis reutilizable (singleton).
// node-redis v6 -> API moderna basada en promesas.
//
// COMO SE CONFIGURA A QUE REDIS APUNTA (precedencia, de mayor a menor):
//   1) Lo que pases a configurar({ ... })   <- programatico, gana siempre
//   2) Variables de entorno                  <- REDIS_URL o REDIS_HOST/PORT/...
//   3) Valores por defecto                   <- 127.0.0.1:6379
//
// Ejemplo (en el arranque de tu app, ANTES de usar el repositorio):
//   const { configurar } = require('@andestec/persistencia-redis');
//   configurar({ host: '10.0.0.5', port: 6380, password: 'secreto', database: 1 });
//
// O por entorno (sin tocar codigo):
//   REDIS_URL=redis://:secreto@10.0.0.5:6380/1
//   ...o por partes:
//   REDIS_HOST=10.0.0.5  REDIS_PORT=6380  REDIS_PASSWORD=secreto  REDIS_DB=1
// ------------------------------------------------------------------
const { createClient } = require('redis');

let client = null;
let opciones = {}; // configuracion programatica acumulada via configurar()

/**
 * Define/ajusta la configuracion de conexion. Debe llamarse ANTES de la
 * primera conexion (antes del primer getClient()/uso del repositorio).
 * @param {{
 *   url?: string, host?: string, port?: number,
 *   username?: string, password?: string, database?: number,
 *   tls?: boolean, socket?: object
 * }} nuevasOpciones
 */
function configurar(nuevasOpciones = {}) {
  if (client && client.isOpen) {
    throw new Error(
      'redisClient: ya hay una conexion abierta. Llama a closeClient() antes de reconfigurar.',
    );
  }
  opciones = { ...opciones, ...nuevasOpciones };
  return opciones;
}

/** Resuelve la config efectiva: configurar() > variables de entorno > defaults. */
function resolverConfig() {
  const env = process.env;
  const o = opciones;

  // Opciones de socket comunes (incluida la estrategia de reconexion).
  const socket = {
    reconnectStrategy: (retries) => Math.min(retries * 100, 2000),
    ...(o.socket || {}),
  };

  const username = o.username || env.REDIS_USERNAME || undefined;
  const password = o.password || env.REDIS_PASSWORD || undefined;
  const database =
    o.database ?? (env.REDIS_DB ? Number(env.REDIS_DB) : undefined);

  // Si hay URL completa (programatica o REDIS_URL), tiene prioridad.
  const url = o.url || env.REDIS_URL;
  if (url) {
    // Extraer la base de datos de la URL (ej: .../2) si no se dio aparte.
    let db = database;
    const m = /\/(\d+)\/?$/.exec(url);
    if (db === undefined && m) db = Number(m[1]);
    return { url, socket, username, password, database: db };
  }

  // Si no, se arma por partes.
  socket.host = o.host || env.REDIS_HOST || '127.0.0.1';
  socket.port = Number(o.port || env.REDIS_PORT || 6379);
  if (o.tls ?? env.REDIS_TLS === 'true') socket.tls = true;

  return { socket, username, password, database };
}

/** Descripcion legible del destino (con la contrasena enmascarada). */
function describirDestino(conf) {
  if (conf.url) return conf.url.replace(/(:)([^@/:]+)(@)/, '$1****$3');
  const tls = conf.socket.tls ? 'rediss' : 'redis';
  const db = conf.database !== undefined ? `/${conf.database}` : '';
  return `${tls}://${conf.socket.host}:${conf.socket.port}${db}`;
}

/**
 * Devuelve un cliente conectado (lo crea la primera vez, lo reutiliza despues).
 * @returns {Promise<import('redis').RedisClientType>}
 */
async function getClient() {
  if (client && client.isOpen) return client;

  const conf = resolverConfig();
  const destino = describirDestino(conf);

  client = createClient(conf);

  client.on('error', (err) => console.error('[redis] error:', err.message));
  client.on('connect', () => console.log('[redis] conectando...'));
  client.on('ready', () => console.log(`[redis] listo en ${destino}`));
  client.on('reconnecting', () => console.log('[redis] reconectando...'));

  await client.connect();
  return client;
}

/** Devuelve la configuracion efectiva resuelta (para depurar), contrasena enmascarada. */
function getConfiguracion() {
  const conf = resolverConfig();
  return { destino: describirDestino(conf), database: conf.database ?? 0 };
}

/** Cierra la conexion de forma ordenada (vacia comandos pendientes). */
async function closeClient() {
  if (client && client.isOpen) {
    await client.quit();
    console.log('[redis] conexion cerrada');
  }
  client = null;
}

module.exports = { getClient, closeClient, configurar, getConfiguracion };
