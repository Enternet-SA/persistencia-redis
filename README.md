# @andestec/persistencia-redis

> Capa de persistencia sobre **Redis** para proyectos Node.js / TypeScript.

Ofrece una API sencilla y tipada para guardar y recuperar datos en Redis, pensada
como reemplazo directo de una persistencia basada en archivos: trabajas con un
**repositorio** (contenedor lógico, equivalente a una carpeta) y una **llave**.

Incluye:

- **`TypedCache` (v0.2)** — caché tipada con cliente inyectable, claves por segmentos,
  namespace/version, codecs con validación en runtime y TTL obligatorio.

- **Primitivas** `PersistenciaSet` / `PersistenciaGet` / `PersistenciaCheck` — misma forma que una API de persistencia clásica (incluida la hora de última modificación).
- **Interfaz `repositorio`** — `obtener` / `guardar` / `eliminar` / `existe` / `listar` / `eliminarRepositorio`.
- **`RedisStore`** — repositorio con *namespace* fijo por instancia (ideal para caché).
- **Conexión configurable** por código o variables de entorno.
- **Integración con NestJS** opcional (`PersistenciaModule`, `PersistenciaService`).
- **Tipos TypeScript** generados (autocompletado y verificación en el consumidor).

---

## Contenido

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Conceptos clave](#conceptos-clave)
- [Configuración de conexión](#configuración-de-conexión)
- [Uso](#uso)
  - [Primitivas](#primitivas)
  - [Interfaz repositorio](#interfaz-repositorio)
  - [RedisStore](#redisstore)
  - [Gestión de la conexión](#gestión-de-la-conexión)
- [Uso con NestJS](#uso-con-nestjs)
- [Referencia de la API](#referencia-de-la-api)
- [Tipos exportados](#tipos-exportados)
- [Desarrollo](#desarrollo)
- [Versionado y publicación](#versionado-y-publicación)

---

## Requisitos

- **Node.js** >= 18
- Un servidor **Redis** accesible (Redis 6 o superior recomendado).

---

## Instalación

Se instala desde GitHub fijando el **tag de versión**:

```bash
npm i git+https://github.com/CristobalEfveliz/persistencia-redis.git#v0.1.0
```

> **Cómo funciona:** al instalarse, el script `prepare` compila TypeScript a `dist/`
> automáticamente, por lo que el repositorio **no versiona** la carpeta `dist/`.
> Necesitas tener acceso de lectura al repositorio (si es privado, configura una clave
> SSH o un token en tu entorno / CI).

Fijar la versión a un tag garantiza **builds reproducibles**. Para actualizar, cambia
el tag (`#v0.2.0`) en el proyecto consumidor.

---

## Conceptos clave

**Repositorio = prefijo de la clave.** Redis no tiene carpetas; el *repositorio* se
concatena como prefijo de la llave:

```
clave_redis = "<repositorio>:<llave>"
```

Así, dos repositorios distintos nunca colisionan aunque usen la misma llave, y todas
las llaves de un repositorio comparten prefijo (se pueden listar o borrar en bloque,
como una carpeta).

**Serialización automática.** Todos los valores se guardan como JSON, así que entran y
salen idénticos (texto, números, objetos, arrays).

**Hora de última modificación.** Redis **no** almacena un `mtime` por clave (a
diferencia del sistema de archivos). Las primitivas lo guardan dentro del valor (un
"sobre") usando el **reloj del servidor Redis**. Por eso solo las claves escritas con
`PersistenciaSet` exponen `ultimaModificacion`.

---

## Configuración de conexión

La conexión es **del cliente**: tú indicas a qué Redis apuntar. La configuración del
servidor (persistencia RDB/AOF, memoria, expulsión) es del servidor y no se define aquí.

**Precedencia** (de mayor a menor): `configurar()` > variables de entorno > valores por
defecto (`127.0.0.1:6379`).

### Programática

```ts
import { configurar } from '@andestec/persistencia-redis';

configurar({
  host: '10.0.0.5',
  port: 6380,
  password: 'secreto',
  database: 1,
  // tls: true,
});
```

> Llama a `configurar()` **una sola vez al arranque**, antes de la primera operación
> (el cliente se crea de forma perezosa en la primera llamada y se reutiliza después).

### Por variables de entorno

| Variable | Descripción |
|----------|-------------|
| `REDIS_URL` | URL completa: `redis://[:pass@]host:puerto[/db]` (o `rediss://` para TLS) |
| `REDIS_HOST` | Host (por defecto `127.0.0.1`) |
| `REDIS_PORT` | Puerto (por defecto `6379`) |
| `REDIS_USERNAME` | Usuario (ACL) |
| `REDIS_PASSWORD` | Contraseña |
| `REDIS_DB` | Índice de base de datos (0–15 por defecto) |
| `REDIS_TLS` | `true` activa TLS |

### Depuración

```ts
import { getConfiguracion } from '@andestec/persistencia-redis';

getConfiguracion(); // -> { destino: 'redis://10.0.0.5:6380/1', database: 1 }  (contraseña enmascarada)
```

---

## Uso

### TypedCache (v0.2)

Esta es la interfaz recomendada para código nuevo. Oculta el formato físico y obliga
a declarar vigencia y validación del dato:

```ts
import { cacheKey, createTypedCache, seconds } from '@andestec/persistencia-redis';

const cache = createTypedCache({
  client,
  namespace: 'dispositivos',
  keyVersion: 'v1',
});

const dispositivo = {
  codec: {
    encode: JSON.stringify,
    decode: (raw: string) => {
      const value: unknown = JSON.parse(raw);
      return typeof value === 'object' && value !== null
        ? { ok: true as const, value }
        : { ok: false as const, reason: 'invalid-device' };
    },
  },
};

const key = cacheKey('977', 'qa', 'Disp01', 'operador');
await cache.put(key, dispositivo, { id: 'Disp01' }, { ttl: seconds(300) });
const result = await cache.get(key, dispositivo);
```

Cada segmento se escapa por separado, por lo que identidades como `['a:b', 'c']` y
`['a', 'b:c']` no colisionan. La versión forma parte de la clave física. Un envelope
o payload inválido produce `kind: 'invalid'` y se elimina de forma best-effort.

En NestJS, `PersistenciaService.crearCache()` entrega la misma interfaz usando la
conexión administrada y cerrada por `PersistenciaModule`.

> ⚠️ **Orden de argumentos.** Las **primitivas** reciben `(repositorio, llave, ...)`.
> La **interfaz `repositorio`** recibe `(llave, repositorio, ...)`. Es intencional para
> respetar ambos contratos; presta atención al orden.

### Primitivas

Las tres primitivas replican una API de persistencia clásica. Todas reciben **primero el
repositorio y luego la llave**, y son asíncronas (usar `await`).

```ts
import {
  configurar,
  PersistenciaSet,
  PersistenciaGet,
  PersistenciaCheck,
} from '@andestec/persistencia-redis';

configurar({ host: '127.0.0.1', port: 6379 }); // una sola vez, al arranque
```

#### `PersistenciaSet(repositorio, llave, valor)`

Guarda un valor y registra su hora de modificación. Si la llave ya existía, la **sobrescribe**.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `repositorio` | `string` | contenedor lógico (prefijo de la clave) |
| `llave` | `string` | identificador dentro del repositorio |
| `valor` | `unknown` | cualquier dato serializable a JSON (texto, número, objeto, array) |

**Devuelve** `Promise<boolean>` (`true` si se guardó).

```ts
await PersistenciaSet('sii/recibidos', 'DTE-33-1001', '<DTE folio="1001">...</DTE>'); // texto
await PersistenciaSet('config', 'descarga', { dias: 30, carpeta: 'C:/DESCARGAS' });   // objeto
await PersistenciaSet('contadores', 'folios', 1024);                                  // número
```

#### `PersistenciaGet(repositorio, llave)`

Lee y deserializa un valor. Si la llave **no existe, devuelve `null`** (no lanza error).

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `repositorio` | `string` | el repositorio donde buscar |
| `llave` | `string` | la llave a leer |

**Devuelve** `Promise<T | null>`. Acepta un genérico `<T>` para tipar el resultado.

```ts
await PersistenciaGet('sii/recibidos', 'DTE-33-1001'); // -> '<DTE folio="1001">...</DTE>'
await PersistenciaGet('sii/recibidos', 'no-existe');   // -> null

interface Config { dias: number; carpeta: string }
const cfg = await PersistenciaGet<Config>('config', 'descarga'); // cfg: Config | null
if (cfg) console.log(cfg.dias); // 30  (con autocompletado tipado)
```

#### `PersistenciaCheck(repositorio, llave)`

Comprueba si una llave existe y cuándo se modificó por última vez.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `repositorio` | `string` | el repositorio |
| `llave` | `string` | la llave a comprobar |

**Devuelve** `Promise<{ ok, ultimaModificacion }>`:

| Campo | Tipo | Significado |
|-------|------|-------------|
| `ok` | `boolean` | `true` si la llave existe |
| `ultimaModificacion` | `Date \| null` | fecha de la última escritura, o `null` si no existe |

```ts
const r = await PersistenciaCheck('sii/recibidos', 'DTE-33-1001');
// -> { ok: true, ultimaModificacion: 2026-06-22T15:16:34.392Z }

if (r.ok) {
  console.log('Guardado el', r.ultimaModificacion!.toLocaleString());
}

await PersistenciaCheck('sii/recibidos', 'no-existe');
// -> { ok: false, ultimaModificacion: null }
```

> La hora la registra `PersistenciaSet` con el reloj del servidor Redis. Solo las llaves
> escritas con esta primitiva tienen `ultimaModificacion`; una guardada por otra vía
> existirá (`ok: true`) pero con `ultimaModificacion: null`.

#### Ejemplo completo

Flujo típico: comprobar si ya existe, guardar, leer y verificar.

```ts
import {
  configurar,
  PersistenciaSet,
  PersistenciaGet,
  PersistenciaCheck,
  closeClient,
} from '@andestec/persistencia-redis';

interface Dte { folio: number; monto: number; xml: string }

async function main() {
  configurar({ host: '127.0.0.1', port: 6379 });

  const repo = 'sii/recibidos';
  const llave = 'DTE-33-1001';

  // 1) ¿Ya lo tenemos guardado?
  const previo = await PersistenciaCheck(repo, llave);
  if (previo.ok) {
    console.log('Ya existía, modificado el', previo.ultimaModificacion);
  }

  // 2) Guardar (sobrescribe si existía)
  await PersistenciaSet(repo, llave, { folio: 1001, monto: 52000, xml: '<DTE/>' });

  // 3) Leer (tipado)
  const dte = await PersistenciaGet<Dte>(repo, llave);
  console.log('Monto:', dte?.monto); // -> 52000

  // 4) Verificar
  console.log(await PersistenciaCheck(repo, llave)); // { ok: true, ultimaModificacion: Date }

  await closeClient(); // al terminar / apagar la app
}

main();
```

### Interfaz repositorio

```ts
import { repositorio } from '@andestec/persistencia-redis';

// guardar(llave, repositorio, valor, opciones?)
await repositorio.guardar('config', 'descargas', { dias: 30 });
await repositorio.guardar('token', 'sesiones', 'abc', { ttlSegundos: 60 }); // expira en 60s

// obtener(llave, repositorio) -> valor | null
await repositorio.obtener('config', 'descargas'); // -> { dias: 30 }

// existe / eliminar
await repositorio.existe('config', 'descargas');   // -> true
await repositorio.eliminar('config', 'descargas'); // -> true

// listar(repositorio) -> string[]  (llaves sin el prefijo)
await repositorio.listar('descargas'); // -> ['config', ...]

// eliminarRepositorio(repositorio) -> número de llaves borradas
await repositorio.eliminarRepositorio('descargas'); // -> 3
```

La misma llave en repositorios distintos **no colisiona**:

```ts
await repositorio.guardar('config', 'descargas', 'A');
await repositorio.guardar('config', 'envios', 'B');
await repositorio.obtener('config', 'descargas'); // -> 'A'
await repositorio.obtener('config', 'envios');    // -> 'B'
```

### RedisStore

Repositorio con *namespace* fijo por instancia. Útil para caché o cuando una parte de
la app trabaja siempre sobre el mismo prefijo.

```ts
import { RedisStore } from '@andestec/persistencia-redis';

const cache = new RedisStore({ namespace: 'sesiones' });

await cache.set('user42', { rol: 'admin' });     // sin expiración
await cache.set('temp', 'x', 30);                // TTL de 30 segundos
await cache.get('user42');                       // -> { rol: 'admin' }
await cache.has('user42');                       // -> true
await cache.ttl('temp');                         // -> segundos restantes
await cache.del('temp');                         // -> 1
await cache.keys();                              // -> ['sesiones:user42', ...]
```

### Gestión de la conexión

```ts
import { getClient, closeClient } from '@andestec/persistencia-redis';

// Acceso al cliente node-redis subyacente (para comandos avanzados):
const client = await getClient();
await client.incr('contador');

// Cierre ordenado, al apagar la aplicación:
await closeClient();
```

---

## Uso con NestJS

Importa el módulo desde el subpath `@andestec/persistencia-redis/nestjs`. `@nestjs/common`
es una **peerDependency opcional**: solo hace falta si usas esta integración.

### Registro del módulo

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersistenciaModule } from '@andestec/persistencia-redis/nestjs';

@Module({
  imports: [
    // Asíncrono, leyendo de ConfigService:
    PersistenciaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        host: cfg.get('REDIS_HOST'),
        port: Number(cfg.get('REDIS_PORT')),
        password: cfg.get('REDIS_PASSWORD'),
      }),
    }),

    // ...o síncrono:
    // PersistenciaModule.forRoot({ host: '127.0.0.1', port: 6379 }),
  ],
})
export class AppModule {}
```

El módulo es **global**: `PersistenciaService` queda disponible en toda la app sin
re-importar. La conexión se cierra automáticamente al apagar (`onModuleDestroy`).

### Inyección del servicio

```ts
import { Injectable } from '@nestjs/common';
import { PersistenciaService } from '@andestec/persistencia-redis/nestjs';

@Injectable()
export class FacturasService {
  constructor(private readonly persistencia: PersistenciaService) {}

  guardarDte(folio: string, xml: string) {
    return this.persistencia.set('sii/recibidos', folio, xml);
  }

  leerDte(folio: string) {
    return this.persistencia.get('sii/recibidos', folio);
  }

  async estaActualizado(folio: string) {
    const { ok, ultimaModificacion } = await this.persistencia.check('sii/recibidos', folio);
    return ok && ultimaModificacion!.getTime() > Date.now() - 86_400_000;
  }
}
```

`PersistenciaService` expone:

| Miembro | Descripción |
|---------|-------------|
| `set(repositorio, llave, valor)` | equivalente a `PersistenciaSet` |
| `get(repositorio, llave)` | equivalente a `PersistenciaGet` |
| `check(repositorio, llave)` | equivalente a `PersistenciaCheck` |
| `repositorio` | la interfaz `repositorio` completa |
| `crearStore(namespace)` | crea un `RedisStore` |

---

## Referencia de la API

### Conexión

| Función | Firma | Devuelve |
|---------|-------|----------|
| `configurar` | `(opciones: OpcionesConexion)` | `OpcionesConexion` |
| `getConfiguracion` | `()` | `{ destino: string; database: number }` |
| `getClient` | `()` | `Promise<ClienteRedis>` |
| `closeClient` | `()` | `Promise<void>` |

### Primitivas

| Función | Firma | Devuelve |
|---------|-------|----------|
| `PersistenciaSet` | `(repositorio, llave, valor)` | `Promise<boolean>` |
| `PersistenciaGet` | `<T>(repositorio, llave)` | `Promise<T \| null>` |
| `PersistenciaCheck` | `(repositorio, llave)` | `Promise<ResultadoCheck>` |

### `repositorio`

| Método | Firma | Devuelve |
|--------|-------|----------|
| `obtener` | `<T>(llave, repositorio)` | `Promise<T \| null>` |
| `guardar` | `(llave, repositorio, valor, opciones?)` | `Promise<boolean>` |
| `eliminar` | `(llave, repositorio)` | `Promise<boolean>` |
| `existe` | `(llave, repositorio)` | `Promise<boolean>` |
| `listar` | `(repositorio)` | `Promise<string[]>` |
| `eliminarRepositorio` | `(repositorio)` | `Promise<number>` |

### `RedisStore`

| Método | Firma | Devuelve |
|--------|-------|----------|
| `constructor` | `({ namespace? })` | — |
| `set` | `(key, value, ttlSeconds?)` | `Promise<boolean>` |
| `get` | `<T>(key)` | `Promise<T \| null>` |
| `del` | `(key)` | `Promise<number>` |
| `has` | `(key)` | `Promise<boolean>` |
| `ttl` | `(key)` | `Promise<number>` |
| `keys` | `()` | `Promise<string[]>` |

### NestJS (`/nestjs`)

| Símbolo | Descripción |
|---------|-------------|
| `PersistenciaModule.forRoot(opciones?)` | registro síncrono (global) |
| `PersistenciaModule.forRootAsync(opciones)` | registro asíncrono con factory |
| `PersistenciaService` | servicio inyectable |

---

## Tipos exportados

```ts
import type {
  OpcionesConexion, // { url?, host?, port?, username?, password?, database?, tls?, socket? }
  OpcionesGuardado, // { ttlSegundos?: number }
  ResultadoCheck,   // { ok: boolean; ultimaModificacion: Date | null }
  IRepositorio,     // contrato de la interfaz repositorio
} from '@andestec/persistencia-redis';
```

`IRepositorio` permite que tu código consumidor dependa del contrato y no de la
implementación: hoy Redis, mañana archivos u otra, sin cambiar quien lo usa.

---

## Desarrollo

```bash
npm install        # instala dependencias y compila (script prepare)
npm run build      # compila src/ -> dist/ (JS + .d.ts + sourcemaps)
npm run typecheck  # verifica tipos de src + test + examples (sin emitir)
npm test           # ejecuta los tests con Jest
```

Los tests requieren un Redis accesible y usan la **base de datos 15** (`127.0.0.1:6379`
por defecto; configurable con `REDIS_HOST` / `REDIS_PORT`). En `scripts/` hay ayudas
para instalar/levantar Redis en WSL.

### Estructura

```
src/
  index.ts          API pública (barrel)
  client.ts         conexión configurable
  persistencia.ts   PersistenciaSet/Get/Check
  repositorio.ts    interfaz repositorio
  store.ts          RedisStore
  types.ts          tipos públicos
  nestjs/           integración NestJS (subpath /nestjs)
test/               pruebas Jest
examples/           ejemplos de uso
scripts/            helpers de Redis (dev)
dist/               salida compilada (generada, no versionada)
```

---

## Versionado y publicación

El paquete usa **SemVer** y se distribuye por **tags de Git**.

Para publicar una nueva versión:

```bash
npm version patch       # o minor / major — actualiza package.json y crea el tag
git push origin main
git push origin v0.2.0  # sube el tag
```

Los proyectos consumidores actualizan cambiando el tag en su `npm install`
(`...#v0.2.0`).
