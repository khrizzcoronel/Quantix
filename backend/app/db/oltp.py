from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

# Engine asíncrono optimizado para alta concurrencia
engine = create_async_engine(
    settings.async_database_uri,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=10
)

# Fábrica de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    """
    Dependencia de FastAPI para inyectar la sesión de base de datos OLTP.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
