/**
 * @andestec/persistencia-redis
 * Capa de persistencia sobre Redis.
 */

// Conexión
export { configurar, getClient, closeClient, getConfiguracion } from './client';
export type { ClienteRedis } from './client';

// Primitivas estilo API de persistencia
export { PersistenciaSet, PersistenciaGet, PersistenciaCheck } from './persistencia';

// Interfaz "repositorio"
export { repositorio } from './repositorio';

// Repositorio con namespace fijo
export { RedisStore } from './store';

// Caché tipada v0.2: cliente inyectado, claves versionadas y TTL obligatorio.
export { cacheKey, createTypedCache, seconds } from './typed-cache';
export type {
  CacheEntry,
  CacheKey,
  CacheObserver,
  CacheOperation,
  CacheOutcome,
  CacheRead,
  Codec,
  DecodeResult,
  RedisCommands,
  Seconds,
  TypedCache,
} from './typed-cache';

// Tipos públicos
export type {
  OpcionesConexion,
  OpcionesGuardado,
  ResultadoCheck,
  IRepositorio,
} from './types';
