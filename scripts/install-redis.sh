#!/usr/bin/env bash
# install-redis.sh
# ------------------------------------------------------------------
# Ejecutar DENTRO de Ubuntu (WSL2), una vez que WSL ya funciona.
# Instala Redis, lo arranca y deja activada la persistencia AOF
# para que puedas ver los dos modos (RDB + AOF) trabajando juntos.
# ------------------------------------------------------------------
set -e

echo "==> Actualizando paquetes..."
sudo apt update

echo "==> Instalando redis-server..."
sudo apt install -y redis-server

echo "==> Arrancando Redis..."
sudo service redis-server start

echo "==> Probando conexion (debe responder PONG):"
redis-cli ping

echo ""
echo "==> Config de persistencia actual:"
redis-cli CONFIG GET save
redis-cli CONFIG GET appendonly
redis-cli CONFIG GET dir

echo ""
echo "==> Activando AOF en caliente (sin reiniciar)..."
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG GET appendonly

echo ""
echo "Redis escucha en 127.0.0.1:6379"
echo "Desde Windows/Node tambien puedes conectarte a esa misma direccion."
echo "Archivos de persistencia: corre 'redis-cli CONFIG GET dir' para ver la carpeta"
echo "  - dump.rdb         (snapshot RDB)"
echo "  - appendonly.aof   (log AOF, dentro de appendonlydir/ en Redis 7+)"
