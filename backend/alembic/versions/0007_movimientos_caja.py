"""create movimiento_caja table and enum

Revision ID: 0007
Revises: 0006
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Crear tipo ENUM en Postgres de forma idempotente
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipomovimientocaja') THEN CREATE TYPE tipomovimientocaja AS ENUM ('INGRESO', 'EGRESO'); END IF; END $$;")

    tipo_enum = ENUM("INGRESO", "EGRESO", name="tipomovimientocaja", create_type=False)

    # 2. Crear tabla movimiento_caja
    op.create_table(
        "movimiento_caja",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sesion_id", UUID(as_uuid=True), sa.ForeignKey("sesion_caja.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usuario_id", UUID(as_uuid=True), sa.ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", tipo_enum, nullable=False),
        sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("concepto", sa.String(length=255), nullable=False),
        sa.Column("fecha_hora", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)
    )
    op.create_index("ix_movimiento_caja_sesion_id", "movimiento_caja", ["sesion_id"])
    op.create_index("ix_movimiento_caja_usuario_id", "movimiento_caja", ["usuario_id"])

def downgrade() -> None:
    op.drop_index("ix_movimiento_caja_usuario_id", table_name="movimiento_caja")
    op.drop_index("ix_movimiento_caja_sesion_id", table_name="movimiento_caja")
    op.drop_table("movimiento_caja")
    op.execute("DROP TYPE IF EXISTS tipomovimientocaja;")
