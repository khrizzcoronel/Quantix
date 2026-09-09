"""create offline sync tables

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ventas_offline_recibidas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("id_local", sa.String(length=64), nullable=False),
        sa.Column("terminal_id", sa.String(length=50), nullable=False),
        sa.Column("sesion_caja_id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("fecha_local", sa.DateTime(), nullable=False),
        sa.Column("fecha_recepcion", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("payload_original", sa.JSON(), nullable=False),
        sa.Column("estado", sa.String(length=30), nullable=False),
        sa.Column("venta_id", sa.UUID(), nullable=True),
        sa.Column("motivo_conflicto", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["sesion_caja_id"], ["sesion_caja.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.ForeignKeyConstraint(["venta_id"], ["ventas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_local", name="uq_ventas_offline_id_local"),
    )
    op.create_index(
        "ix_ventas_offline_recibidas_id_local",
        "ventas_offline_recibidas",
        ["id_local"],
        unique=True,
    )
    op.create_index(
        "ix_ventas_offline_recibidas_sesion_caja_id",
        "ventas_offline_recibidas",
        ["sesion_caja_id"],
    )
    op.create_index(
        "ix_ventas_offline_recibidas_usuario_id",
        "ventas_offline_recibidas",
        ["usuario_id"],
    )
    op.create_index(
        "ix_ventas_offline_recibidas_venta_id",
        "ventas_offline_recibidas",
        ["venta_id"],
    )
    op.create_index(
        "ix_ventas_offline_recibidas_estado",
        "ventas_offline_recibidas",
        ["estado"],
    )

    op.create_table(
        "incidencias_sync",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("venta_offline_id", sa.UUID(), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("detalle", sa.Text(), nullable=False),
        sa.Column("resuelto", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("resuelto_por", sa.UUID(), nullable=True),
        sa.Column("resuelto_en", sa.DateTime(), nullable=True),
        sa.Column("nota_resolucion", sa.Text(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["resuelto_por"], ["usuario.id"]),
        sa.ForeignKeyConstraint(["venta_offline_id"], ["ventas_offline_recibidas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_incidencias_sync_venta_offline_id",
        "incidencias_sync",
        ["venta_offline_id"],
    )
    op.create_index(
        "ix_incidencias_sync_tipo",
        "incidencias_sync",
        ["tipo"],
    )
    op.create_index(
        "ix_incidencias_sync_resuelto",
        "incidencias_sync",
        ["resuelto"],
    )


def downgrade() -> None:
    op.drop_index("ix_incidencias_sync_resuelto", table_name="incidencias_sync")
    op.drop_index("ix_incidencias_sync_tipo", table_name="incidencias_sync")
    op.drop_index("ix_incidencias_sync_venta_offline_id", table_name="incidencias_sync")
    op.drop_table("incidencias_sync")

    op.drop_index("ix_ventas_offline_recibidas_estado", table_name="ventas_offline_recibidas")
    op.drop_index("ix_ventas_offline_recibidas_venta_id", table_name="ventas_offline_recibidas")
    op.drop_index("ix_ventas_offline_recibidas_usuario_id", table_name="ventas_offline_recibidas")
    op.drop_index("ix_ventas_offline_recibidas_sesion_caja_id", table_name="ventas_offline_recibidas")
    op.drop_index("ix_ventas_offline_recibidas_id_local", table_name="ventas_offline_recibidas")
    op.drop_table("ventas_offline_recibidas")
