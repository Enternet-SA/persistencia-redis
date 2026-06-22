// persistencia.js
// ------------------------------------------------------------------
// Las 3 primitivas de vuestra API de persistencia, sobre Redis:
//
//   PersistenciaSet(repositorio, llave, valor)  -> guarda. Devuelve OK.
//   PersistenciaGet(repositorio, llave)         -> devuelve el valor (o null).
//   PersistenciaCheck(repositorio, llave)       -> { ok, ultimaModificacion }
//
// IMPORTANTE - hora de ultima modificacion:
//   Redis NO guarda un mtime por clave (a diferencia del sistema de
//   archivos). Por eso lo guardamos nosotros al escribir, dentro de un
//   "sobre":  { __pv: <valor>, __pm: <epoch_ms> }
//   La hora se toma del reloj del SERVIDOR Redis (comando TIME), para
//   que sea consistente aunque escriban varias instancias de la API.
//
// Orden de argumentos: (repositorio, llave) -> igual que vuestra API
// actual. (La otra interfaz, repositorioRedis.js, usa (llave, repositorio).)
// ------------------------------------------------------------------
const { getClient } = require('./redisClient');

const SEPARADOR = ':';
const CAMPO_VALOR = '__pv';      // dentro del sobre: el valor real
const CAMPO_MTIME = '__pm';      // dentro del sobre: epoch ms de modificacion

function construirClave(repositorio, llave) {
  if (!repositorio) throw new Error('persistencia: el "repositorio" es obligatorio');
  if (!llave) throw new Error('persistencia: la "llave" es obligatoria');
  return `${repositorio}${SEPARADOR}${llave}`;
}

/** Hora actual en ms segun el reloj del servidor Redis (comando TIME). */
async function ahoraServidorMs(c) {
  try {
    const t = await c.sendCommand(['TIME']); // ["segundos", "microsegundos"]
    return Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000);
  } catch {
    return Date.now(); // respaldo: reloj local
  }
}

/**
 * Guarda un valor en el repositorio, registrando la hora de modificacion.
 * @param {string} repositorio
 * @param {string} llave
 * @param {any} valor  cualquier valor serializable a JSON
 * @returns {Promise<boolean>} OK
 */
async function PersistenciaSet(repositorio, llave, valor) {
  const c = await getClient();
  const sobre = {
    [CAMPO_VALOR]: valor,
    [CAMPO_MTIME]: await ahoraServidorMs(c),
  };
  await c.set(construirClave(repositorio, llave), JSON.stringify(sobre));
  return true;
}

/**
 * Lee el valor del repositorio.
 * @returns {Promise<any|null>} el valor, o null si no existe
 */
async function PersistenciaGet(repositorio, llave) {
  const c = await getClient();
  const crudo = await c.get(construirClave(repositorio, llave));
  if (crudo === null) return null;
  const dato = JSON.parse(crudo);
  // Si viene con sobre, desenvolver; si no, devolver tal cual (compatibilidad).
  if (dato && typeof dato === 'object' && CAMPO_VALOR in dato) {
    return dato[CAMPO_VALOR];
  }
  return dato;
}

/**
 * Comprueba existencia y hora de ultima modificacion.
 * @returns {Promise<{ ok: boolean, ultimaModificacion: Date|null }>}
 *   ok                 -> true si la llave existe en el repositorio
 *   ultimaModificacion -> Date de la ultima escritura (null si no existe
 *                         o si se guardo sin sobre)
 */
async function PersistenciaCheck(repositorio, llave) {
  const c = await getClient();
  const crudo = await c.get(construirClave(repositorio, llave));
  if (crudo === null) {
    return { ok: false, ultimaModificacion: null };
  }
  let ultimaModificacion = null;
  try {
    const dato = JSON.parse(crudo);
    if (dato && typeof dato === 'object' && CAMPO_MTIME in dato) {
      ultimaModificacion = new Date(dato[CAMPO_MTIME]);
    }
  } catch {
    // valor no-JSON: existe pero sin marca de tiempo
  }
  return { ok: true, ultimaModificacion };
}

module.exports = {
  PersistenciaSet,
  PersistenciaGet,
  PersistenciaCheck,
};
