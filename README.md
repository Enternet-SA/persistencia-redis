# POC Redis en JavaScript — Persistencia en memoria

Prueba de concepto para entender **qué ofrece Redis** y cómo funcionan sus
mecanismos de persistencia, con un módulo exportable listo para integrar en una API.

## ¿Qué es Redis?

Una base de datos **en memoria (RAM)** de tipo clave-valor, extremadamente rápida
(microsegundos). Se usa como caché, cola de mensajes, contador, sesiones, rankings,
rate-limiting, pub/sub, locks distribuidos, etc. Al vivir en RAM es volátil por
naturaleza, por eso ofrece **persistencia a disco** para no perder datos al reiniciar.

## Los modos de persistencia

| Modo | Qué hace | Pro | Contra |
|------|----------|-----|--------|
| **RDB** (snapshots) | Guarda una "foto" del dataset cada cierto tiempo en `dump.rdb` | Compacto, arranque rápido, poco impacto | Puedes perder los datos entre dos snapshots |
| **AOF** (append-only file) | Registra **cada comando de escritura** en `appendonly.aof` | Más durable (pérdida ~1s), reconstruible | Archivo más grande, recuperación más lenta |
| **none** | Sin persistencia, solo RAM | Máxima velocidad | Se pierde todo al reiniciar (caché pura) |
| **RDB + AOF** | Ambos a la vez (recomendado) | Durabilidad + arranque rápido | Algo más de disco/CPU |

### Cómo se configuran (`redis.conf` o en caliente con `CONFIG SET`)

- **RDB:** `save 3600 1 300 100 60 10000` → guarda si en 3600s hubo ≥1 cambio,
  o en 300s ≥100, o en 60s ≥10000. `save ""` lo desactiva.
- **AOF:** `appendonly yes` y `appendfsync everysec` (equilibrio durabilidad/rendimiento;
  alternativas: `always` = máxima seguridad/lento, `no` = lo decide el SO).

Disparo manual desde el cliente: `BGSAVE` (snapshot RDB en background),
`BGREWRITEAOF` (compactar AOF), `LASTSAVE` (timestamp del último RDB).

## Archivos de esta POC

| Archivo | Para qué |
|---------|----------|
| `redisClient.js` | **Módulo exportable**: cliente Redis singleton con reconexión |
| `persistence-store.js` | **Módulo exportable**: repositorio JSON + TTL + namespace (lo que usa tu API) |
| `01-tipos-datos.js` | Recorrido por String, Hash, List, Set, Sorted Set, TTL |
| `02-persistencia.js` | Inspecciona config, dispara RDB/AOF, prueba durabilidad |
| `03-store-demo.js` | Demo del `RedisStore` con objetos reales |
| `setup-wsl-redis.ps1` | Repara WSL en Windows (ejecutar como admin) |
| `install-redis.sh` | Instala Redis dentro de Ubuntu/WSL |
| `redis.conf` | Config de ejemplo comentada con opciones de persistencia |

## Cómo correrlo

### 1. Levantar Redis (vía WSL — pendiente de reiniciar)

```powershell
# PowerShell COMO ADMINISTRADOR:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-wsl-redis.ps1
# -> REINICIAR el equipo
# tras reiniciar, de nuevo como admin:
wsl --update
wsl --install -d Ubuntu
```

Dentro de Ubuntu:
```bash
bash install-redis.sh     # instala y arranca Redis en 127.0.0.1:6379
redis-cli ping            # -> PONG
```

### 2. Correr la POC (desde Windows, en esta carpeta)

```bash
node 01-tipos-datos.js
node 02-persistencia.js
node 03-store-demo.js
```

> El cliente Node se conecta a `redis://127.0.0.1:6379`. Redis en WSL2 es
> accesible desde Windows en esa misma dirección. Cambia con la variable de
> entorno `REDIS_URL` si hace falta.

### 3. Comprobar la durabilidad (la prueba clave)

```bash
node 02-persistencia.js                      # escribe 1000 claves + BGSAVE
# en Ubuntu:
sudo service redis-server restart            # reinicia el server
redis-cli get persist:test:500               # -> "valor-500" SOBREVIVE = persistió
```

## Próximo paso bloqueado

WSL daba `REGDB_E_CLASSNOTREG`. Ejecuta `setup-wsl-redis.ps1` como administrador
y reinicia. Después la POC corre tal cual.
