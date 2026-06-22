import { Test, TestingModule } from '@nestjs/testing';
import { PersistenciaModule, PersistenciaService } from '../src/nestjs';
import { repositorio } from '../src/repositorio';

const REPO = 'test/nestjs';

describe('PersistenciaModule (NestJS)', () => {
  let moduleRef: TestingModule;
  let service: PersistenciaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        PersistenciaModule.forRoot({
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
          database: 15,
        }),
      ],
    }).compile();

    await moduleRef.init();
    service = moduleRef.get(PersistenciaService);
  });

  afterAll(async () => {
    await repositorio.eliminarRepositorio(REPO);
    await moduleRef.close(); // dispara onModuleDestroy -> closeClient()
  });

  it('inyecta PersistenciaService', () => {
    expect(service).toBeInstanceOf(PersistenciaService);
  });

  it('set/get/check funcionan vía el servicio', async () => {
    await service.set(REPO, 'k', { ok: true });
    await expect(service.get(REPO, 'k')).resolves.toEqual({ ok: true });
    const c = await service.check(REPO, 'k');
    expect(c.ok).toBe(true);
    expect(c.ultimaModificacion).toBeInstanceOf(Date);
  });

  it('expone la interfaz repositorio', async () => {
    await service.repositorio.guardar('cfg', REPO, 123);
    await expect(service.repositorio.obtener('cfg', REPO)).resolves.toBe(123);
  });
});
