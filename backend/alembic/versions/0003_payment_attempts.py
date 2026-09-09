"""add persistent payment attempts

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intentos_pago",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("checkout_idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("indice", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("sesion_caja_id", sa.UUID(), nullable=False),
        sa.Column("venta_id", sa.UUID(), nullable=True),
        sa.Column("metodo_pago", sa.String(length=30), nullable=False),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False),
        sa.Column("escenario_simulado", sa.String(length=30), nullable=True),
        sa.Column("referencia_pasarela", sa.String(length=255), nullable=True),
        sa.Column("codigo_respuesta", sa.String(length=20), nullable=True),
        sa.Column("detalle", sa.String(length=500), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["sesion_caja_id"], ["sesion_caja.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("checkout_idempotency_key", "indice", name="uq_intento_pago_checkout_indice"),
    )
    op.create_index("ix_intentos_pago_checkout_idempotency_key", "intentos_pago", ["checkout_idempotency_key"])
    op.create_index("ix_intentos_pago_estado", "intentos_pago", ["estado"])


def downgrade() -> None:
    op.drop_index("ix_intentos_pago_estado", table_name="intentos_pago")
    op.drop_index("ix_intentos_pago_checkout_idempotency_key", table_name="intentos_pago")
    op.drop_table("intentos_pago")
