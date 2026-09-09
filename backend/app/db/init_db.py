import logging
from sqlalchemy import text
from app.db.oltp import engine

logger = logging.getLogger(__name__)

async def init_reportes_tables():
    """
    Garantiza que la tabla de plantillas de reporte y las vistas auxiliares para
    el motor DuckDB existan en PostgreSQL tanto en arranque como en testing.
    """
    async with engine.begin() as conn:
        # Asegurar columna sucursal_id en usuario si no existe
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='usuario' AND column_name='sucursal_id'
                ) THEN
                    ALTER TABLE usuario ADD COLUMN sucursal_id UUID REFERENCES sucursal(id);
                END IF;
            END $$;
        """))

        # Asegurar tabla plantillas_reporte
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS plantillas_reporte (
                id UUID PRIMARY KEY,
                usuario_id UUID REFERENCES usuario(id) ON DELETE CASCADE,
                sucursal_id UUID REFERENCES sucursal(id) ON DELETE SET NULL,
                nombre VARCHAR(100) NOT NULL,
                descripcion VARCHAR(255),
                configuracion_json JSON NOT NULL,
                es_publica BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # Asegurar vistas auxiliares
        await conn.execute(text("CREATE OR REPLACE VIEW usuarios AS SELECT * FROM usuario;"))
        await conn.execute(text("CREATE OR REPLACE VIEW sucursales AS SELECT * FROM sucursal;"))
        await conn.execute(text("CREATE OR REPLACE VIEW categoria_producto AS SELECT * FROM categoria;"))
        logger.info("Tablas y vistas de reportes inicializadas exitosamente.")
