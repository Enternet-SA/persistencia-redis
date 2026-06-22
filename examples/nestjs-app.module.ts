/**
 * Ejemplo: registrar PersistenciaModule en una app NestJS.
 *
 * Importa el subpath '@andestec/persistencia-redis/nestjs'.
 * (Aquí se importa desde '../src/nestjs' por estar dentro del propio paquete.)
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersistenciaModule } from '../src/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),

    // Opción A: configuración síncrona
    // PersistenciaModule.forRoot({ host: '127.0.0.1', port: 6379 }),

    // Opción B: asíncrona, leyendo de ConfigService
    PersistenciaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        host: cfg.get<string>('REDIS_HOST'),
        port: Number(cfg.get<string>('REDIS_PORT') ?? 6379),
        password: cfg.get<string>('REDIS_PASSWORD'),
        database: Number(cfg.get<string>('REDIS_DB') ?? 0),
      }),
    }),
  ],
})
export class AppModule {}

/*
  Uso en un servicio cualquiera:

  @Injectable()
  export class FacturasService {
    constructor(private readonly persistencia: PersistenciaService) {}

    guardarDte(folio: string, xml: string) {
      return this.persistencia.set('sii/recibidos', folio, xml);
    }
  }
*/
