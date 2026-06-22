// index.js
// ------------------------------------------------------------------
// Punto de entrada del paquete. Lo que se importa desde otros proyectos.
//
//   const persistencia = require('@andestec/persistencia-redis');
//
//   // primitivas (vuestra API):
//   await persistencia.PersistenciaSet('repo', 'llave', valor);
//   await persistencia.PersistenciaGet('repo', 'llave');
//   await persistencia.PersistenciaCheck('repo', 'llave');
//
//   // interfaz repositorio:
//   await persistencia.repositorio.guardar('llave', 'repo', valor);
//
//   // conexion (opcional, para cerrar al apagar la app):
//   await persistencia.closeClient();
// ------------------------------------------------------------------
const { getClient, closeClient, configurar, getConfiguracion } = require('./redisClient');
const { PersistenciaSet, PersistenciaGet, PersistenciaCheck } = require('./persistencia');
const repositorio = require('./repositorioRedis');
const { RedisStore } = require('./persistence-store');

module.exports = {
  // --- Configuracion de conexion (llamar al arranque, antes de usar) ---
  configurar,
  getConfiguracion,

  // --- Primitivas estilo vuestra API de persistencia ---
  PersistenciaSet,
  PersistenciaGet,
  PersistenciaCheck,

  // --- Interfaz "repositorio" (obtener/guardar/eliminar/existe/listar) ---
  repositorio,

  // --- Repositorio con namespace fijo por instancia ---
  RedisStore,

  // --- Gestion de conexion ---
  getClient,
  closeClient,
};
