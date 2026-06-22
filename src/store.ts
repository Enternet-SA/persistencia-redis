import { getClient } from './client';

/**
 * Repositorio clave-valor con un namespace fijo por instancia.
 * Útil cuando una parte de la app trabaja siempre sobre el mismo prefijo.
 */
export class RedisStore {
  private readonly namespace: string;

  constructor(opts: { namespace?: string } = {}) {
    this.namespace = opts.namespace ?? 'app';
  }

  private clave(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /** Guarda un valor (serializado a JSON), con TTL opcional en segundos. */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    const c = await getClient();
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await c.set(this.clave(key), payload, { EX: ttlSeconds });
    } else {
      await c.set(this.clave(key), payload);
    }
    return true;
  }

  /** Lee y deserializa un valor. `null` si no existe. */
  async get<T = unknown>(key: string): Promise<T | null> {
    const c = await getClient();
    const raw = await c.get(this.clave(key));
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  /** Elimina una clave. Devuelve cuántas borró (0 o 1). */
  async del(key: string): Promise<number> {
    const c = await getClient();
    return c.del(this.clave(key));
  }

  /** ¿Existe la clave? */
  async has(key: string): Promise<boolean> {
    const c = await getClient();
    return (await c.exists(this.clave(key))) === 1;
  }

  /** Segundos restantes de vida (-1 sin TTL, -2 no existe). */
  async ttl(key: string): Promise<number> {
    const c = await getClient();
    return c.ttl(this.clave(key));
  }

  /** Lista las claves del namespace (usa SCAN, seguro en producción). */
  async keys(): Promise<string[]> {
    const c = await getClient();
    const found: string[] = [];
    for await (const lote of c.scanIterator({ MATCH: `${this.namespace}:*`, COUNT: 100 })) {
      const claves = Array.isArray(lote) ? (lote as string[]) : [lote as string];
      found.push(...claves);
    }
    return found;
  }
}
