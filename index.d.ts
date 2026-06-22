// index.d.ts — definiciones de tipos del paquete @andestec/persistencia-redis

import type { RedisClientType } from 'redis';

// ---- Configuracion de conexion ----
export interface OpcionesConexion {
  /** URL completa; tiene prioridad sobre host/port. Ej: redis://:pass@host:6379/0 */
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  /** Indice de base de datos (0-15 por defecto en Redis). */
  database?: number;
  /** true para TLS (rediss://). */
  tls?: boolean;
  /** Opciones de socket de node-redis (connectTimeout, reconnectStrategy, etc.). */
  socket?: Record<string, unknown>;
}

/** Define la conexion. Llamar al arranque, antes del primer uso. */
export function configurar(opciones: OpcionesConexion): OpcionesConexion;

/** Configuracion efectiva resuelta (para depurar), contrasena enmascarada. */
export function getConfiguracion(): { destino: string; database: number };

// ---- Primitivas estilo API de persistencia ----
export function PersistenciaSet(
  repositorio: string,
  llave: string,
  valor: unknown,
): Promise<boolean>;

export function PersistenciaGet<T = unknown>(
  repositorio: string,
  llave: string,
): Promise<T | null>;

export interface ResultadoCheck {
  /** true si la llave existe en el repositorio */
  ok: boolean;
  /** fecha de ultima escritura, o null si no existe / sin marca */
  ultimaModificacion: Date | null;
}

export function PersistenciaCheck(
  repositorio: string,
  llave: string,
): Promise<ResultadoCheck>;

// ---- Interfaz "repositorio" (orden: llave, repositorio) ----
export interface OpcionesGuardado {
  ttlSegundos?: number;
}

export interface Repositorio {
  obtener<T = unknown>(llave: string, repositorio: string): Promise<T | null>;
  guardar(
    llave: string,
    repositorio: string,
    valor: unknown,
    opciones?: OpcionesGuardado,
  ): Promise<boolean>;
  eliminar(llave: string, repositorio: string): Promise<boolean>;
  existe(llave: string, repositorio: string): Promise<boolean>;
  listar(repositorio: string): Promise<string[]>;
  eliminarRepositorio(repositorio: string): Promise<number>;
  SEPARADOR: string;
}

export const repositorio: Repositorio;

// ---- Repositorio con namespace fijo por instancia ----
export class RedisStore {
  constructor(opts?: { namespace?: string });
  set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
  get<T = unknown>(key: string): Promise<T | null>;
  del(key: string): Promise<number>;
  has(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(): Promise<string[]>;
}

// ---- Conexion ----
export function getClient(): Promise<RedisClientType>;
export function closeClient(): Promise<void>;
