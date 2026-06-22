import { RedisStore } from '../src/store';
import { closeClient, getClient } from '../src/client';
import { initRedisTest } from './helpers';

const store = new RedisStore({ namespace: 'test:store' });

beforeAll(() => initRedisTest());

afterAll(async () => {
  const c = await getClient();
  const claves = await store.keys();
  if (claves.length) await c.del(claves);
  await closeClient();
});

describe('RedisStore', () => {
  it('set/get con un objeto', async () => {
    await store.set('user', { id: 1 });
    await expect(store.get('user')).resolves.toEqual({ id: 1 });
  });

  it('has y del', async () => {
    await store.set('tmp', 1);
    expect(await store.has('tmp')).toBe(true);
    await store.del('tmp');
    expect(await store.has('tmp')).toBe(false);
  });

  it('ttl refleja la expiración', async () => {
    await store.set('exp', 'x', 50);
    const ttl = await store.ttl('exp');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(50);
  });

  it('keys lista las claves con el namespace', async () => {
    await store.set('k1', 1);
    await expect(store.keys()).resolves.toContain('test:store:k1');
  });
});
