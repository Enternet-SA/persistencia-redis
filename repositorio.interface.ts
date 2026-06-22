// repositorio.interface.ts
// ------------------------------------------------------------------
// Contrato (interfaz) de la persistencia estilo "repositorio".
// Permite intercambiar la implementacion: hoy archivos locales,
// manana Redis, sin tocar el codigo que la consume.
// ------------------------------------------------------------------

export interface OpcionesGuardado {
  /** Expiracion opcional en segundos. Sin valor = persistente. */
  ttlSegundos?: number;
}

/**
 * Repositorio clave-valor. "repositorio" es el contenedor logico
 * (en archivos = carpeta; en Redis = prefijo de la clave).
 */
export interface IRepositorio {
  /** Lee un valor. Devuelve null si la llave no existe en el repositorio. */
  obtener<T = unknown>(llave: string, repositorio: string): Promise<T | null>;

  /** Guarda un valor (cualquiera serializable). */
  guardar(
    llave: string,
    repositorio: string,
    valor: unknown,
    opciones?: OpcionesGuardado,
  ): Promise<boolean>;

  /** Elimina una llave. true si existia. */
  eliminar(llave: string, repositorio: string): Promise<boolean>;

  /** Indica si la llave existe en el repositorio. */
  existe(llave: string, repositorio: string): Promise<boolean>;

  /** Lista las llaves del repositorio (sin el prefijo). */
  listar(repositorio: string): Promise<string[]>;

  /** Borra todas las llaves del repositorio. Devuelve cuantas borro. */
  eliminarRepositorio(repositorio: string): Promise<number>;
}
