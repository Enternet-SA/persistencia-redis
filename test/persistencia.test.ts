import { PersistenciaSet, PersistenciaGet, PersistenciaCheck } from '../src/persistencia';
import { repositorio } from '../src/repositorio';
import { closeClient } from '../src/client';
import { initRedisTest } from './helpers';

const REPO = 'test/persistencia';

beforeAll(() => initRedisTest());

afterAll(async () => {
  await repositorio.eliminarRepositorio(REPO);
  await closeClient();
});

describe('Primitivas Persistencia', () => {
  it('Set + Get devuelve el mismo valor', async () => {
    await PersistenciaSet(REPO, 'objeto', { folio: 1001, monto: 52000 });
    await expect(PersistenciaGet(REPO, 'objeto')).resolves.toEqual({ folio: 1001, monto: 52000 });
  });

  it('Get de una llave inexistente devuelve null', async () => {
    await expect(PersistenciaGet(REPO, 'no-existe')).resolves.toBeNull();
  });

  it('Check de una llave existente devuelve ok=true y una fecha', async () => {
    await PersistenciaSet(REPO, 'doc', '<DTE/>');
    const r = await PersistenciaCheck(REPO, 'doc');
    expect(r.ok).toBe(true);
    expect(r.ultimaModificacion).toBeInstanceOf(Date);
  });

  it('Check de una llave inexistente devuelve ok=false y null', async () => {
    await expect(PersistenciaCheck(REPO, 'no-existe')).resolves.toEqual({
      ok: false,
      ultimaModificacion: null,
    });
  });

  it('re-escribir actualiza la hora de última modificación', async () => {
    await PersistenciaSet(REPO, 'mtime', 'v1');
    const a = await PersistenciaCheck(REPO, 'mtime');
    await new Promise((r) => setTimeout(r, 1100));
    await PersistenciaSet(REPO, 'mtime', 'v2');
    const b = await PersistenciaCheck(REPO, 'mtime');
    expect(b.ultimaModificacion!.getTime()).toBeGreaterThan(a.ultimaModificacion!.getTime());
  });
});
