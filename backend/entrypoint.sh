#!/bin/bash
set -e

echo "Esperando a que PostgreSQL este listo en ${POSTGRES_SERVER}:${POSTGRES_PORT}..."
while ! nc -z "${POSTGRES_SERVER}" "${POSTGRES_PORT}"; do
  sleep 1
done
echo "PostgreSQL esta listo."

if [ "${AUTO_SEED:-true}" = "true" ]; then
  echo "Comprobando esquema y datos base..."
  python -c "
import asyncio
from app.db.oltp import async_session_factory
from app.models.usuarios import Usuario
from sqlalchemy import select

async def check():
    try:
        async with async_session_factory() as session:
            res = await session.execute(select(Usuario))
            if not res.scalars().first():
                print('Sembrando datos demo iniciales...')
                from app.seed import seed_database
                await seed_database()
            else:
                print('Base de datos ya cuenta con registros.')
    except Exception as e:
        print('Inicializando tablas y sembrando datos...', e)
        from app.seed import seed_database
        await seed_database()

asyncio.run(check())
" || true
fi

exec "$@"
