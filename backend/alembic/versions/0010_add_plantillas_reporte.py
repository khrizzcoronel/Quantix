"""create plantillas_reporte table and sucursal_id in usuario

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Agregar sucursal_id a usuario si no existe
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='usuario' AND column_name='sucursal_id'
            ) THEN
                ALTER TABLE usuario ADD COLUMN sucursal_id UUID REFERENCES sucursal(id);
            END IF;
        END $$;
    """)

    # 2. Crear tabla plantillas_reporte si no existe
    op.execute("""
        CREATE TABLE IF NOT EXISTS plantillas_reporte (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID REFERENCES usuario(id) ON DELETE CASCADE,
            sucursal_id UUID REFERENCES sucursal(id) ON DELETE SET NULL,
            nombre VARCHAR(100) NOT NULL,
            descripcion VARCHAR(255),
            configuracion_json JSON NOT NULL,
            es_publica BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_plantillas_reporte_usuario ON plantillas_reporte(usuario_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_plantillas_reporte_sucursal ON plantillas_reporte(sucursal_id);")

    # 3. Asegurar vistas de compatibilidad para DuckDB / PostgreSQL
    op.execute("CREATE OR REPLACE VIEW usuarios AS SELECT * FROM usuario;")
    op.execute("CREATE OR REPLACE VIEW sucursales AS SELECT * FROM sucursal;")
    op.execute("CREATE OR REPLACE VIEW categoria_producto AS SELECT * FROM categoria;")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS plantillas_reporte;")
    op.execute("ALTER TABLE usuario DROP COLUMN IF EXISTS sucursal_id;")
