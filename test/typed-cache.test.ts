import {
  cacheKey,
  createTypedCache,
  seconds,
  type CacheObserver,
  type RedisCommands,
} from '../src/typed-cache';

class FakeRedis implements RedisCommands {
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string, options: { EX: number }) {
    this.values.set(key, value);
    this.ttls.set(key, options.EX);
    return 'OK';
  }

  async del(key: string) {
    this.ttls.delete(key);
    return this.values.delete(key) ? 1 : 0;
  }
}

const numberEntry = {
  codec: {
    encode: (value: number) => String(value),
    decode: (raw: string) => {
      const value = Number(raw);
      return Number.isFinite(value)
        ? ({ ok: true, value } as const)
        : ({ ok: false, reason: 'not-a-number' } as const);
    },
  },
};

describe('TypedCache', () => {
  it('guarda con TTL obligatorio y recupera mediante el codec', async () => {
    const client = new FakeRedis();
    const cache = createTypedCache({ client, namespace: 'dispositivos', keyVersion: 'v2' });
    const key = cacheKey('empresa:977', 'qa', 'disp/1', 'admin');

    await cache.put(key, numberEntry, 40, { ttl: seconds(300) });

    expect([...client.values.keys()]).toEqual([
      'dispositivos:v2:empresa%3A977:qa:disp%2F1:admin',
    ]);
    expect([...client.ttls.values()]).toEqual([300]);
    await expect(cache.get(key, numberEntry)).resolves.toEqual({ kind: 'hit', value: 40 });
  });

  it('evita colisiones entre componentes de identidad', () => {
    expect(cacheKey('a:b', 'c')).not.toBe(cacheKey('a', 'b:c'));
    expect(cacheKey('977', 'qa', 'disp-1', 'admin')).not.toBe(
      cacheKey('977', 'prod', 'disp-1', 'admin'),
    );
    expect(cacheKey('977', 'qa', 'disp-1', 'admin')).not.toBe(
      cacheKey('977', 'qa', 'disp-1', 'operador'),
    );
  });

  it('rechaza TTL, namespace y segmentos inválidos', () => {
    expect(() => seconds(0)).toThrow('entero positivo');
    expect(() => seconds(1.5)).toThrow('entero positivo');
    expect(() => cacheKey()).toThrow('al menos un segmento');
    expect(() => cacheKey('')).toThrow('no puede estar vacío');
    expect(() => createTypedCache({ client: new FakeRedis(), namespace: '' })).toThrow(
      'no puede estar vacío',
    );
  });

  it('distingue miss de dato inválido y elimina corrupción best-effort', async () => {
    const client = new FakeRedis();
    const cache = createTypedCache({ client, namespace: 'parametros' });
    const missing = cacheKey('missing');
    const invalid = cacheKey('invalid');

    await expect(cache.get(missing, numberEntry)).resolves.toEqual({ kind: 'miss' });
    client.values.set('parametros:v1:invalid', '{"version":1,"payload":"nope"}');
    await expect(cache.get(invalid, numberEntry)).resolves.toEqual({
      kind: 'invalid',
      reason: 'not-a-number',
    });
    expect(client.values.has('parametros:v1:invalid')).toBe(false);
  });

  it('observa resultados sin exponer claves ni valores', async () => {
    const events: Parameters<CacheObserver['observe']>[0][] = [];
    const client = new FakeRedis();
    const cache = createTypedCache({
      client,
      namespace: 'parametros',
      observe: { observe: (event) => events.push(event) },
    });

    await cache.get(cacheKey('977', 'qa'), numberEntry);

    expect(events).toEqual([
      expect.objectContaining({ operation: 'get', outcome: 'miss' }),
    ]);
    expect(JSON.stringify(events)).not.toContain('977');
  });
});
