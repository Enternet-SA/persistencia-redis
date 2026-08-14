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

// Tipos públicos
export type {
  OpcionesConexion,
  OpcionesGuardado,
  ResultadoCheck,
  IRepositorio,
} from './types';
