import { configurar } from '../src/client';

/**
 * Configura la conexión de pruebas. Usa la base de datos 15 para no
 * interferir con datos reales. Permite override por variables de entorno.
 */
export function initRedisTest(): void {
  configurar({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    database: 15,
  });
}
