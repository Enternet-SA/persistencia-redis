import { repositorio } from '../src/repositorio';
import { closeClient } from '../src/client';
import { initRedisTest } from './helpers';

const REPO = 'test/repo';
const REPO_B = 'test/repo-b';

beforeAll(() => initRedisTest());

afterAll(async () => {
  await repositorio.eliminarRepositorio(REPO);
  await repositorio.eliminarRepositorio(REPO_B);
  await closeClient();
});

describe('Interfaz repositorio', () => {
  it('guardar + obtener hace round-trip del valor', async () => {
    await repositorio.guardar('k', REPO, { a: 1 });
    await expect(repositorio.obtener('k', REPO)).resolves.toEqual({ a: 1 });
  });

  it('la misma llave en repositorios distintos no colisiona', async () => {
    await repositorio.guardar('config', REPO, 'A');
    await repositorio.guardar('config', REPO_B, 'B');
    expect(await repositorio.obtener('config', REPO)).toBe('A');
    expect(await repositorio.obtener('config', REPO_B)).toBe('B');
  });

  it('existe y eliminar funcionan', async () => {
    await repositorio.guardar('x', REPO, 1);
    expect(await repositorio.existe('x', REPO)).toBe(true);
    expect(await repositorio.eliminar('x', REPO)).toBe(true);
    expect(await repositorio.existe('x', REPO)).toBe(false);
  });

  it('listar devuelve las llaves sin el prefijo', async () => {
    await repositorio.eliminarRepositorio(REPO);
    await repositorio.guardar('a', REPO, 1);
    await repositorio.guardar('b', REPO, 2);
    const llaves = (await repositorio.listar(REPO)).sort();
    expect(llaves).toEqual(['a', 'b']);
  });

  it('eliminarRepositorio borra todo el repositorio', async () => {
    await repositorio.guardar('a', REPO, 1);
    await repositorio.guardar('b', REPO, 2);
    const n = await repositorio.eliminarRepositorio(REPO);
    expect(n).toBeGreaterThanOrEqual(2);
    await expect(repositorio.listar(REPO)).resolves.toEqual([]);
  });
});
