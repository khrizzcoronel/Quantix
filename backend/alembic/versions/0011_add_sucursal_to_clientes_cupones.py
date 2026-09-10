"""add sucursal to clientes and cupones

Revision ID: 0011
Revises: 0010
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0011"
down_revision: Union[str, Sequence[str], None] = "0010"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Agregar columna sucursal_id a clientes
    op.add_column(
        "clientes",
        sa.Column("sucursal_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), nullable=True)
    )
    op.create_index("ix_clientes_sucursal_id", "clientes", ["sucursal_id"])

    # 2. Agregar columna sucursal_id a cupones
    op.add_column(
        "cupones",
        sa.Column("sucursal_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), nullable=True)
    )
    op.create_index("ix_cupones_sucursal_id", "cupones", ["sucursal_id"])

    # 3. Poblar datos existentes en las 3 sucursales
    matriz_id = "00000000-0000-0000-0000-000000000001"
    norte_id = "01ec96ea-a7c9-4656-823b-48ce8eb7739a"
    sur_id = "72cdafc3-3658-40bd-b79f-3d684cc0733d"

    # Distribuir clientes:
    op.execute(f"""
        WITH cte AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY nombre ASC) as rn
            FROM clientes
        )
        UPDATE clientes c
        SET sucursal_id = CASE 
            WHEN cte.rn <= 18 THEN '{matriz_id}'::uuid
            WHEN cte.rn <= 30 THEN '{norte_id}'::uuid
            ELSE '{sur_id}'::uuid
        END
        FROM cte
        WHERE c.id = cte.id;
    """)

    # Distribuir cupones:
    op.execute(f"""
        WITH cte AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en DESC, codigo ASC) as rn
            FROM cupones
        )
        UPDATE cupones c
        SET sucursal_id = CASE 
            WHEN cte.rn <= 10 THEN '{matriz_id}'::uuid
            WHEN cte.rn <= 18 THEN '{norte_id}'::uuid
            ELSE '{sur_id}'::uuid
        END
        FROM cte
        WHERE c.id = cte.id;
    """)

def downgrade() -> None:
    op.drop_index("ix_cupones_sucursal_id", table_name="cupones")
    op.drop_column("cupones", "sucursal_id")
    op.drop_index("ix_clientes_sucursal_id", table_name="clientes")
    op.drop_column("clientes", "sucursal_id")
