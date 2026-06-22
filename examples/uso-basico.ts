/**
 * Ejemplo de uso básico. Requiere un Redis accesible.
 * Ejecutar (desde la raíz del paquete):  npx ts-node examples/uso-basico.ts
 */
import {
  configurar,
  PersistenciaSet,
  PersistenciaGet,
  PersistenciaCheck,
  repositorio,
  closeClient,
} from '../src';

async function main(): Promise<void> {
  // Configuración de conexión (o vía variables de entorno REDIS_*).
  configurar({ host: '127.0.0.1', port: 6379 });

  // Primitivas estilo API de persistencia.
  await PersistenciaSet('sii/recibidos', 'DTE-33-1001', '<DTE folio="1001">...</DTE>');
  console.log('Get:', await PersistenciaGet('sii/recibidos', 'DTE-33-1001'));
  console.log('Check:', await PersistenciaCheck('sii/recibidos', 'DTE-33-1001'));

  // Interfaz repositorio (obtener/guardar...).
  await repositorio.guardar('config', 'descargas', { dias: 30, carpeta: 'C:/DESCARGAS' });
  console.log('repositorio:', await repositorio.obtener('config', 'descargas'));

  await closeClient();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
