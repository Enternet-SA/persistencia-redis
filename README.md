# @andestec/persistencia-redis

Capa de persistencia sobre **Redis** para proyectos Node/TypeScript. Expone:

- **Primitivas** `PersistenciaSet` / `PersistenciaGet` / `PersistenciaCheck` (misma forma que la API de persistencia basada en archivos).
- **Interfaz `repositorio`** (`obtener` / `guardar` / `eliminar` / `existe` / `listar`), donde el *repositorio* es un prefijo de la clave (equivalente a una carpeta).
- **`RedisStore`**, repositorio con namespace fijo por instancia.
- **Conexión configurable** por código o variables de entorno.

## Instalación

```bash
npm i git+https://github.com/CristobalEfveliz/persistencia-redis.git#v0.1.0
```

> Se instala desde Git fijando el tag de versión. El paquete se **compila solo** al instalarse (script `prepare`), por lo que no se versiona `dist/`.

## Configuración de conexión

Precedencia: `configurar()` > variables de entorno > valores por defecto (`127.0.0.1:6379`).

```ts
import { configurar } from '@andestec/persistencia-redis';

configurar({
  host: '10.0.0.5',
  port: 6380,
  password: 'secreto',
  database: 1,
});
```

Variables de entorno soportadas:

| Variable | Descripción |
|----------|-------------|
| `REDIS_URL` | URL completa: `redis://[:pass@]host:puerto[/db]` (o `rediss://` para TLS) |
| `REDIS_HOST`, `REDIS_PORT` | Host y puerto |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | Credenciales (ACL) |
| `REDIS_DB` | Índice de base de datos |
| `REDIS_TLS=true` | Activa TLS |

`getConfiguracion()` devuelve el destino resuelto (con la contraseña enmascarada) para depurar.

## Uso

### Primitivas

```ts
import { PersistenciaSet, PersistenciaGet, PersistenciaCheck } from '@andestec/persistencia-redis';

await PersistenciaSet('sii/recibidos', 'DTE-33-1001', '<DTE/>');
await PersistenciaGet('sii/recibidos', 'DTE-33-1001');   // -> '<DTE/>'
await PersistenciaCheck('sii/recibidos', 'DTE-33-1001'); // -> { ok: true, ultimaModificacion: Date }
```

> **Nota:** Redis no almacena una hora de modificación por clave; `PersistenciaSet`
> la guarda dentro del valor (un "sobre") usando el reloj del servidor. Por eso solo
> las claves escritas con `PersistenciaSet` tienen `ultimaModificacion`.

### Interfaz repositorio

```ts
import { repositorio } from '@andestec/persistencia-redis';

await repositorio.guardar('config', 'descargas', { dias: 30 }); // (llave, repositorio, valor)
await repositorio.obtener('config', 'descargas');               // -> { dias: 30 }
await repositorio.listar('descargas');                          // -> ['config']
```

### RedisStore

```ts
import { RedisStore } from '@andestec/persistencia-redis';

const cache = new RedisStore({ namespace: 'sesiones' });
await cache.set('user42', { rol: 'admin' }, 30); // TTL 30s
await cache.get('user42');
```

### Cierre

```ts
import { closeClient } from '@andestec/persistencia-redis';
await closeClient(); // al apagar la app
```

## Uso con NestJS

Importa el módulo desde el subpath `@andestec/persistencia-redis/nestjs`
(`@nestjs/common` es una *peerDependency* opcional; solo se necesita si usas esta integración).

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersistenciaModule } from '@andestec/persistencia-redis/nestjs';

@Module({
  imports: [
    PersistenciaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        host: cfg.get('REDIS_HOST'),
        port: Number(cfg.get('REDIS_PORT')),
        password: cfg.get('REDIS_PASSWORD'),
      }),
    }),
    // o síncrono: PersistenciaModule.forRoot({ host: '127.0.0.1', port: 6379 }),
  ],
})
export class AppModule {}
```

El módulo es **global**, así que `PersistenciaService` queda disponible en toda la app
sin re-importar. Cierra la conexión solo al apagar (`onModuleDestroy`).

```ts
import { Injectable } from '@nestjs/common';
import { PersistenciaService } from '@andestec/persistencia-redis/nestjs';

@Injectable()
export class FacturasService {
  constructor(private readonly persistencia: PersistenciaService) {}

  guardarDte(folio: string, xml: string) {
    return this.persistencia.set('sii/recibidos', folio, xml); // (repositorio, llave, valor)
  }

  leerDte(folio: string) {
    return this.persistencia.get('sii/recibidos', folio);
  }
}
```

`PersistenciaService` expone `set` / `get` / `check`, la propiedad `repositorio`
(interfaz completa) y `crearStore(namespace)`.

## API

| Símbolo | Firma |
|---------|-------|
| `configurar(opciones)` | define la conexión |
| `getConfiguracion()` | `{ destino, database }` |
| `PersistenciaSet(repositorio, llave, valor)` | `Promise<boolean>` |
| `PersistenciaGet(repositorio, llave)` | `Promise<T \| null>` |
| `PersistenciaCheck(repositorio, llave)` | `Promise<{ ok, ultimaModificacion }>` |
| `repositorio.*` | `obtener/guardar/eliminar/existe/listar/eliminarRepositorio` |
| `RedisStore` | `set/get/del/has/ttl/keys` |
| `getClient()` / `closeClient()` | acceso/cierre del cliente |

## Desarrollo

```bash
npm install        # instala dependencias y compila (prepare)
npm run build      # compila src/ -> dist/
npm test           # ejecuta los tests (requieren un Redis accesible)
```

Los tests usan la base de datos **15** de Redis (`127.0.0.1:6379` por defecto; configurable con `REDIS_HOST`/`REDIS_PORT`). En `scripts/` hay ayudas para levantar Redis en Windows/WSL.

## Estructura

```
src/        código fuente TypeScript
test/       pruebas Jest
examples/   ejemplos de uso
scripts/    helpers para levantar Redis (dev)
dist/       salida compilada (generada)
```
