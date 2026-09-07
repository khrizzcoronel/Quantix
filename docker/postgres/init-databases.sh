#!/bin/bash
set -e

echo "Inicializando bases de datos adicionales de Quantix..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE quantix_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'quantix_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE quantix_test TO $POSTGRES_USER;
EOSQL
echo "Bases de datos inicializadas correctamente."
