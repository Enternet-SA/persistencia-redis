import { getClient } from './client';
import type { IRepositorio, OpcionesGuardado } from './types';

const SEPARADOR = ':';

function construirClave(repositorio: string, llave: string): string {
  if (!repositorio) throw new Error('repositorio: el "repositorio" es obligatorio');
  if (!llave) throw new Error('repositorio: la "llave" es obligatoria');
  return `${repositorio}${SEPARADOR}${llave}`;
}

/** Normaliza lo que entrega scanIterator (en node-redis v6 son lotes/arrays). */
function aLista(lote: unknown): string[] {
  return Array.isArray(lote) ? (lote as string[]) : [lote as string];
}

/**
 * Interfaz de persistencia estilo "repositorio" sobre Redis.
 * La clave Redis es `"<repositorio>:<llave>"`.
 */
export const repositorio: IRepositorio = {
  async obtener<T = unknown>(llave: string, repo: string): Promise<T | null> {
    const c = await getClient();
    const crudo = await c.get(construirClave(repo, llave));
    return crudo === null ? null : (JSON.parse(crudo) as T);
  },

  async guardar(llave, repo, valor, opciones: OpcionesGuardado = {}) {
    const c = await getClient();
    const clave = construirClave(repo, llave);
    const payload = JSON.stringify(valor);
    if (opciones.ttlSegundos) {
      await c.set(clave, payload, { EX: opciones.ttlSegundos });
    } else {
      await c.set(clave, payload);
    }
    return true;
  },

  async eliminar(llave, repo) {
    const c = await getClient();
    return (await c.del(construirClave(repo, llave))) === 1;
  },

  async existe(llave, repo) {
    const c = await getClient();
    return (await c.exists(construirClave(repo, llave))) === 1;
  },

  async listar(repo) {
    const c = await getClient();
    const prefijo = `${repo}${SEPARADOR}`;
    const llaves: string[] = [];
    for await (const lote of c.scanIterator({ MATCH: `${prefijo}*`, COUNT: 100 })) {
      for (const clave of aLista(lote)) llaves.push(clave.slice(prefijo.length));
    }
    return llaves;
  },

  async eliminarRepositorio(repo) {
    const c = await getClient();
    const prefijo = `${repo}${SEPARADOR}`;
    let borradas = 0;
    for await (const lote of c.scanIterator({ MATCH: `${prefijo}*`, COUNT: 100 })) {
      const claves = aLista(lote);
      if (claves.length) borradas += await c.del(claves);
    }
    return borradas;
  },
};
