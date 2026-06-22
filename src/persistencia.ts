import { getClient } from './client';
import type { ClienteRedis } from './client';
import type { ResultadoCheck } from './types';

const SEPARADOR = ':';
const CAMPO_VALOR = '__pv'; // dentro del sobre: el valor real
const CAMPO_MTIME = '__pm'; // dentro del sobre: epoch ms de modificación

function construirClave(repositorio: string, llave: string): string {
  if (!repositorio) throw new Error('persistencia: el "repositorio" es obligatorio');
  if (!llave) throw new Error('persistencia: la "llave" es obligatoria');
  return `${repositorio}${SEPARADOR}${llave}`;
}

/** Hora actual en ms según el reloj del servidor Redis (comando TIME). */
async function ahoraServidorMs(c: ClienteRedis): Promise<number> {
  try {
    const t = (await c.sendCommand(['TIME'])) as unknown as string[];
    return Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000);
  } catch {
    return Date.now(); // respaldo: reloj local
  }
}

/**
 * Guarda un valor en el repositorio, registrando la hora de modificación.
 * Redis no guarda un mtime por clave, así que lo almacenamos dentro de un
 * "sobre" `{ __pv: valor, __pm: epoch_ms }`.
 */
export async function PersistenciaSet(
  repositorio: string,
  llave: string,
  valor: unknown,
): Promise<boolean> {
  const c = await getClient();
  const sobre = { [CAMPO_VALOR]: valor, [CAMPO_MTIME]: await ahoraServidorMs(c) };
  await c.set(construirClave(repositorio, llave), JSON.stringify(sobre));
  return true;
}

/** Lee el valor del repositorio. Devuelve `null` si no existe. */
export async function PersistenciaGet<T = unknown>(
  repositorio: string,
  llave: string,
): Promise<T | null> {
  const c = await getClient();
  const crudo = await c.get(construirClave(repositorio, llave));
  if (crudo === null) return null;
  const dato = JSON.parse(crudo);
  if (dato && typeof dato === 'object' && CAMPO_VALOR in dato) {
    return dato[CAMPO_VALOR] as T;
  }
  return dato as T; // valor guardado sin sobre (compatibilidad)
}

/**
 * Comprueba existencia y hora de última modificación.
 * @returns `{ ok, ultimaModificacion }`
 */
export async function PersistenciaCheck(
  repositorio: string,
  llave: string,
): Promise<ResultadoCheck> {
  const c = await getClient();
  const crudo = await c.get(construirClave(repositorio, llave));
  if (crudo === null) {
    return { ok: false, ultimaModificacion: null };
  }
  let ultimaModificacion: Date | null = null;
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
