import { createClient } from 'redis';
import type { OpcionesConexion } from './types';

/** Tipo del cliente Redis subyacente. */
export type ClienteRedis = ReturnType<typeof createClient>;

let client: ClienteRedis | null = null;
let opciones: OpcionesConexion = {};

/**
 * Define o ajusta la configuración de conexión. Debe llamarse ANTES de la
 * primera operación (antes del primer `getClient()` o uso del repositorio).
 *
 * Precedencia (de mayor a menor): `configurar()` > variables de entorno > defaults.
 */
export function configurar(nuevasOpciones: OpcionesConexion = {}): OpcionesConexion {
  if (client && client.isOpen) {
    throw new Error(
      'persistencia-redis: ya hay una conexión abierta. Llama a closeClient() antes de reconfigurar.',
    );
  }
  opciones = { ...opciones, ...nuevasOpciones };
  return opciones;
}

interface ConfigResuelta {
  url?: string;
  socket: Record<string, unknown>;
  username?: string;
  password?: string;
  database?: number;
}

/** Resuelve la config efectiva: `configurar()` > variables de entorno > defaults. */
function resolverConfig(): ConfigResuelta {
  const env = process.env;
  const o = opciones;

  const socket: Record<string, unknown> = {
    reconnectStrategy: (retries: number) => Math.min(retries * 100, 2000),
    ...(o.socket ?? {}),
  };

  const username = o.username ?? env.REDIS_USERNAME ?? undefined;
  const password = o.password ?? env.REDIS_PASSWORD ?? undefined;
  const database = o.database ?? (env.REDIS_DB ? Number(env.REDIS_DB) : undefined);

  const url = o.url ?? env.REDIS_URL;
  if (url) {
    let db = database;
    const m = /\/(\d+)\/?$/.exec(url);
    if (db === undefined && m) db = Number(m[1]);
    return { url, socket, username, password, database: db };
  }

  socket.host = o.host ?? env.REDIS_HOST ?? '127.0.0.1';
  socket.port = Number(o.port ?? env.REDIS_PORT ?? 6379);
  if (o.tls ?? env.REDIS_TLS === 'true') socket.tls = true;

  return { socket, username, password, database };
}

/** Descripción legible del destino (contraseña enmascarada). */
function describirDestino(conf: ConfigResuelta): string {
  if (conf.url) return conf.url.replace(/(:)([^@/:]+)(@)/, '$1****$3');
  const tls = conf.socket.tls ? 'rediss' : 'redis';
  const host = String(conf.socket.host);
  const port = String(conf.socket.port);
  const db = conf.database !== undefined ? `/${conf.database}` : '';
  return `${tls}://${host}:${port}${db}`;
}

/**
 * Devuelve un cliente conectado (lo crea la primera vez, lo reutiliza después).
 */
export async function getClient(): Promise<ClienteRedis> {
  if (client && client.isOpen) return client;

  const conf = resolverConfig();
  const destino = describirDestino(conf);

  client = createClient(conf as Parameters<typeof createClient>[0]);
  client.on('error', (err: Error) => console.error('[persistencia-redis] error:', err.message));
  client.on('ready', () => console.log(`[persistencia-redis] conectado a ${destino}`));

  await client.connect();
  return client;
}

/** Devuelve la configuración efectiva resuelta (para depurar), contraseña enmascarada. */
export function getConfiguracion(): { destino: string; database: number } {
  const conf = resolverConfig();
  return { destino: describirDestino(conf), database: conf.database ?? 0 };
}

/** Cierra la conexión de forma ordenada (vacía comandos pendientes). */
export async function closeClient(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
  }
  client = null;
}
