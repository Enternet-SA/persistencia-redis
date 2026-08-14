import { Injectable } from '@nestjs/common';
import { PersistenciaSet, PersistenciaGet, PersistenciaCheck } from '../persistencia';
import { repositorio as repositorioImpl } from '../repositorio';
import { RedisStore } from '../store';
import { getClient } from '../client';
import { createTypedCache } from '../typed-cache';
import type { CacheObserver, RedisCommands } from '../typed-cache';
import type { IRepositorio, ResultadoCheck } from '../types';

/**
 * Servicio inyectable que expone la persistencia sobre Redis.
 * Disponible en toda la app tras importar `PersistenciaModule.forRoot()`.
 */
@Injectable()
export class PersistenciaService {
  private readonly commands: RedisCommands = {
    get: async (key) => (await getClient()).get(key),
    set: async (key, value, options) => (await getClient()).set(key, value, options),
    del: async (key) => (await getClient()).del(key),
  };

  /** Interfaz repositorio (obtener/guardar/eliminar/existe/listar/eliminarRepositorio). */
  readonly repositorio: IRepositorio = repositorioImpl;

  /** Guarda un valor registrando la hora de modificación. */
  set(repositorio: string, llave: string, valor: unknown): Promise<boolean> {
    return PersistenciaSet(repositorio, llave, valor);
  }

  /** Lee un valor. Devuelve `null` si no existe. */
  get<T = unknown>(repositorio: string, llave: string): Promise<T | null> {
    return PersistenciaGet<T>(repositorio, llave);
  }

  /** Comprueba existencia y hora de última modificación. */
  check(repositorio: string, llave: string): Promise<ResultadoCheck> {
    return PersistenciaCheck(repositorio, llave);
  }

  /** Crea un repositorio con namespace fijo (RedisStore). */
  crearStore(namespace: string): RedisStore {
    return new RedisStore({ namespace });
  }

  /** Crea una caché aislada con claves versionadas y TTL obligatorio. */
  crearCache(options: Readonly<{
    namespace: string;
    keyVersion?: string;
    observe?: CacheObserver;
  }>) {
    return createTypedCache({ client: this.commands, ...options });
  }
}
