// repositorioRedis.js
// ------------------------------------------------------------------
// Interfaz de persistencia estilo "repositorio" sobre Redis.
//
// En vuestros proyectos actuales el argumento "repositorio" es la
// CARPETA donde se guardan los archivos. Redis no tiene carpetas, asi
// que el repositorio se concatena como PREFIJO de la llave:
//
//      clave_redis = "<repositorio>:<llave>"
//
// De este modo:
//   - dos repositorios distintos nunca colisionan aunque usen la misma llave
//   - todas las llaves de un repositorio comparten prefijo (se pueden
//     listar o borrar en bloque, como una carpeta)
//
// Firma respetada:
//   obtener(llave, repositorio)            -> devuelve el valor (o null)
//   guardar(llave, repositorio, valor)     -> guarda el valor
//
// Uso:
//   const repo = require('./repositorioRedis');
//   await repo.guardar('factura-1001', 'sii/recibidos', { monto: 52000 });
//   const v = await repo.obtener('factura-1001', 'sii/recibidos');
// ------------------------------------------------------------------
const { getClient } = require('./redisClient');

const SEPARADOR = ':';

/** Construye la clave Redis a partir de repositorio + llave. */
function construirClave(repositorio, llave) {
  if (repositorio === undefined || repositorio === null || repositorio === '') {
    throw new Error('repositorioRedis: el "repositorio" es obligatorio');
  }
  if (llave === undefined || llave === null || llave === '') {
    throw new Error('repositorioRedis: la "llave" es obligatoria');
  }
  return `${repositorio}${SEPARADOR}${llave}`;
}

/**
 * Lee un valor del repositorio.
 * @param {string} llave
 * @param {string} repositorio
 * @returns {Promise<any|null>} el valor deserializado, o null si no existe
 */
async function obtener(llave, repositorio) {
  const c = await getClient();
  const crudo = await c.get(construirClave(repositorio, llave));
  return crudo === null ? null : JSON.parse(crudo);
}

/**
 * Guarda un valor en el repositorio (persistente, sin expiracion).
 * @param {string} llave
 * @param {string} repositorio
 * @param {any} valor  cualquier valor serializable a JSON (texto, numero, objeto...)
 * @param {{ ttlSegundos?: number }} [opciones]  expiracion opcional en segundos
 * @returns {Promise<boolean>} true si se guardo
 */
async function guardar(llave, repositorio, valor, opciones = {}) {
  const c = await getClient();
  const clave = construirClave(repositorio, llave);
  const payload = JSON.stringify(valor);
  if (opciones.ttlSegundos) {
    await c.set(clave, payload, { EX: opciones.ttlSegundos });
  } else {
    await c.set(clave, payload);
  }
  return true;
}

/**
 * Elimina una llave del repositorio.
 * @returns {Promise<boolean>} true si existia y se borro
 */
async function eliminar(llave, repositorio) {
  const c = await getClient();
  return (await c.del(construirClave(repositorio, llave))) === 1;
}

/**
 * Indica si la llave existe en el repositorio.
 * @returns {Promise<boolean>}
 */
async function existe(llave, repositorio) {
  const c = await getClient();
  return (await c.exists(construirClave(repositorio, llave))) === 1;
}

/**
 * Lista las llaves contenidas en un repositorio (sin el prefijo).
 * Usa SCAN, seguro para producccion (no bloquea como KEYS).
 * @param {string} repositorio
 * @returns {Promise<string[]>}
 */
async function listar(repositorio) {
  const c = await getClient();
  const prefijo = `${repositorio}${SEPARADOR}`;
  const llaves = [];
  for await (const lote of c.scanIterator({ MATCH: `${prefijo}*`, COUNT: 100 })) {
    for (const claveCompleta of lote) {
      llaves.push(claveCompleta.slice(prefijo.length));
    }
  }
  return llaves;
}

/**
 * Borra TODAS las llaves de un repositorio (como vaciar una carpeta).
 * @param {string} repositorio
 * @returns {Promise<number>} cantidad de llaves eliminadas
 */
async function eliminarRepositorio(repositorio) {
  const c = await getClient();
  const prefijo = `${repositorio}${SEPARADOR}`;
  let borradas = 0;
  for await (const lote of c.scanIterator({ MATCH: `${prefijo}*`, COUNT: 100 })) {
    if (lote.length) borradas += await c.del(lote);
  }
  return borradas;
}

module.exports = {
  obtener,
  guardar,
  eliminar,
  existe,
  listar,
  eliminarRepositorio,
  SEPARADOR,
};
