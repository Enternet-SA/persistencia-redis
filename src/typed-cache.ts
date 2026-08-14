const cacheKeyBrand: unique symbol = Symbol('CacheKey');
const secondsBrand: unique symbol = Symbol('Seconds');

export type CacheKey = string & { readonly [cacheKeyBrand]: true };
export type Seconds = number & { readonly [secondsBrand]: true };

export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<number>;
}

export type DecodeResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: string }>;

export interface Codec<T> {
  encode(value: T): string;
  decode(raw: string): DecodeResult<T>;
}

export type CacheRead<T> =
  | Readonly<{ kind: 'hit'; value: T }>
  | Readonly<{ kind: 'miss' }>
  | Readonly<{ kind: 'invalid'; reason: string }>;

export interface CacheEntry<T> {
  codec: Codec<T>;
}

export type CacheOperation = 'get' | 'put' | 'remove';
export type CacheOutcome = 'hit' | 'miss' | 'invalid' | 'success' | 'error';

export interface CacheObserver {
  observe(event: Readonly<{
    operation: CacheOperation;
    outcome: CacheOutcome;
    durationMs: number;
  }>): void;
}

export interface TypedCache {
  get<T>(key: CacheKey, entry: CacheEntry<T>): Promise<CacheRead<T>>;
  put<T>(
    key: CacheKey,
    entry: CacheEntry<T>,
    value: T,
    options: Readonly<{ ttl: Seconds }>,
  ): Promise<void>;
  remove(key: CacheKey): Promise<void>;
}

interface CacheEnvelope {
  version: 1;
  payload: string;
}

function requireSegment(value: string, name: string) {
  if (value.length === 0) throw new Error(`${name} no puede estar vacío`);
  return value;
}

export function cacheKey(...segments: readonly string[]): CacheKey {
  if (segments.length === 0) throw new Error('CacheKey requiere al menos un segmento');
  return segments
    .map((segment, index) => encodeURIComponent(requireSegment(segment, `segments[${index}]`)))
    .join(':') as CacheKey;
}

export function seconds(value: number): Seconds {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Seconds debe ser un entero positivo');
  }
  return value as Seconds;
}

function parseEnvelope(raw: string): DecodeResult<CacheEnvelope> {
  try {
    const candidate: unknown = JSON.parse(raw);
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'version' in candidate &&
      candidate.version === 1 &&
      'payload' in candidate &&
      typeof candidate.payload === 'string'
    ) {
      return { ok: true, value: { version: 1, payload: candidate.payload } };
    }
    return { ok: false, reason: 'invalid-envelope' };
  } catch {
    return { ok: false, reason: 'invalid-envelope' };
  }
}

export function createTypedCache(options: Readonly<{
  client: RedisCommands;
  namespace: string;
  keyVersion?: string;
  observe?: CacheObserver;
}>): TypedCache {
  const namespace = encodeURIComponent(requireSegment(options.namespace, 'namespace'));
  const keyVersion = encodeURIComponent(requireSegment(options.keyVersion ?? 'v1', 'keyVersion'));

  const physicalKey = (key: CacheKey) => `${namespace}:${keyVersion}:${key}`;
  const timed = async <T>(
    operation: CacheOperation,
    work: () => Promise<Readonly<{ value: T; outcome: CacheOutcome }>>,
  ) => {
    const startedAt = Date.now();
    try {
      const result = await work();
      options.observe?.observe({
        operation,
        outcome: result.outcome,
        durationMs: Date.now() - startedAt,
      });
      return result.value;
    } catch (error) {
      options.observe?.observe({
        operation,
        outcome: 'error',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  };

  return {
    get: <T>(key: CacheKey, entry: CacheEntry<T>) =>
      timed<CacheRead<T>>('get', async () => {
        const raw = await options.client.get(physicalKey(key));
        if (raw === null) return { value: { kind: 'miss' } as const, outcome: 'miss' };

        const envelope = parseEnvelope(raw);
        if (!envelope.ok) {
          await options.client.del(physicalKey(key)).catch(() => 0);
          return {
            value: { kind: 'invalid', reason: envelope.reason } as const,
            outcome: 'invalid',
          };
        }

        const decoded = entry.codec.decode(envelope.value.payload);
        if (!decoded.ok) {
          await options.client.del(physicalKey(key)).catch(() => 0);
          return {
            value: { kind: 'invalid', reason: decoded.reason } as const,
            outcome: 'invalid',
          };
        }

        return { value: { kind: 'hit', value: decoded.value } as const, outcome: 'hit' };
      }),
    put: (key, entry, value, putOptions) =>
      timed('put', async () => {
        const envelope: CacheEnvelope = { version: 1, payload: entry.codec.encode(value) };
        await options.client.set(physicalKey(key), JSON.stringify(envelope), {
          EX: putOptions.ttl,
        });
        return { value: undefined, outcome: 'success' };
      }),
    remove: (key) =>
      timed('remove', async () => {
        await options.client.del(physicalKey(key));
        return { value: undefined, outcome: 'success' };
      }),
  };
}
