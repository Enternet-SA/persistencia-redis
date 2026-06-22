/**
 * Tipos públicos de la librería.
 */

/** Opciones de conexión al servidor Redis. */
export interface OpcionesConexion {
  /** URL completa; tiene prioridad sobre host/port. Ej: `redis://:pass@host:6379/0`. */
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  /** Índice de base de datos (0-15 por defecto en Redis). */
  database?: number;
  /** `true` para conexión TLS (`rediss://`). */
  tls?: boolean;
  /** Opciones de socket de node-redis (connectTimeout, reconnectStrategy, etc.). */
  socket?: Record<string, unknown>;
}

/** Opciones al guardar en la interfaz `repositorio`. */
export interface OpcionesGuardado {
  /** Expiración opcional en segundos. Sin valor = persistente. */
  ttlSegundos?: number;
}

/** Resultado de `PersistenciaCheck`. */
export interface ResultadoCheck {
  /** `true` si la llave existe en el repositorio. */
  ok: boolean;
  /** Fecha de última escritura, o `null` si no existe / sin marca de tiempo. */
  ultimaModificacion: Date | null;
}

/**
 * Contrato de la persistencia estilo "repositorio".
 * El "repositorio" es el contenedor lógico (en archivos = carpeta;
 * en Redis = prefijo de la clave). Permite intercambiar la implementación
 * (hoy archivos, mañana Redis) sin tocar el código consumidor.
 */
export interface IRepositorio {
  /** Lee un valor. Devuelve `null` si la llave no existe. */
  obtener<T = unknown>(llave: string, repositorio: string): Promise<T | null>;
  /** Guarda un valor (cualquiera serializable a JSON). */
  guardar(
    llave: string,
    repositorio: string,
    valor: unknown,
    opciones?: OpcionesGuardado,
  ): Promise<boolean>;
  /** Elimina una llave. `true` si existía. */
  eliminar(llave: string, repositorio: string): Promise<boolean>;
  /** Indica si la llave existe en el repositorio. */
  existe(llave: string, repositorio: string): Promise<boolean>;
  /** Lista las llaves del repositorio (sin el prefijo). */
  listar(repositorio: string): Promise<string[]>;
  /** Borra todas las llaves del repositorio. Devuelve cuántas borró. */
  eliminarRepositorio(repositorio: string): Promise<number>;
}
