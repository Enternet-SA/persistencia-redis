import { DynamicModule, Global, Module, OnModuleDestroy } from '@nestjs/common';
import { configurar, closeClient } from '../client';
import type { OpcionesConexion } from '../types';
import { PersistenciaService } from './persistencia.service';

/** Opciones para registrar el módulo de forma asíncrona (p. ej. con ConfigService). */
export interface PersistenciaModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => OpcionesConexion | Promise<OpcionesConexion>;
}

const TOKEN_OPCIONES = 'PERSISTENCIA_OPCIONES';
const TOKEN_INIT = 'PERSISTENCIA_INIT';

/**
 * Módulo global de persistencia sobre Redis.
 *
 * Síncrono:
 *   PersistenciaModule.forRoot({ host: '...', port: 6379 })
 *
 * Asíncrono (con ConfigService):
 *   PersistenciaModule.forRootAsync({
 *     imports: [ConfigModule],
 *     inject: [ConfigService],
 *     useFactory: (cfg: ConfigService) => ({
 *       host: cfg.get('REDIS_HOST'),
 *       port: Number(cfg.get('REDIS_PORT')),
 *       password: cfg.get('REDIS_PASSWORD'),
 *     }),
 *   })
 */
@Global()
@Module({})
export class PersistenciaModule implements OnModuleDestroy {
  /** Registro síncrono: aplica la configuración inmediatamente. */
  static forRoot(opciones: OpcionesConexion = {}): DynamicModule {
    configurar(opciones);
    return {
      module: PersistenciaModule,
      providers: [PersistenciaService],
      exports: [PersistenciaService],
    };
  }

  /** Registro asíncrono: resuelve la configuración con una factory. */
  static forRootAsync(options: PersistenciaModuleAsyncOptions): DynamicModule {
    const proveedorOpciones = {
      provide: TOKEN_OPCIONES,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };
    const proveedorInit = {
      provide: TOKEN_INIT,
      useFactory: (opciones: OpcionesConexion) => configurar(opciones ?? {}),
      inject: [TOKEN_OPCIONES],
    };
    return {
      module: PersistenciaModule,
      imports: options.imports ?? [],
      providers: [proveedorOpciones, proveedorInit, PersistenciaService],
      exports: [PersistenciaService],
    };
  }

  /** Cierra la conexión a Redis al destruir el módulo (app.close()). */
  async onModuleDestroy(): Promise<void> {
    await closeClient();
  }
}
