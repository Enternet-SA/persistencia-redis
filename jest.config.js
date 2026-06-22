/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  testTimeout: 15000,
  setupFiles: ['reflect-metadata'],
  // Los tests requieren un Redis accesible (por defecto 127.0.0.1:6379,
  // base de datos 15 para no interferir con datos reales).
};
