"""create multi sucursal and transferencias tables

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Crear tabla sucursal
    op.create_table(
        "sucursal",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("codigo", sa.String(length=50), nullable=False, unique=True),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("direccion", sa.String(length=500), nullable=True),
        sa.Column("telefono", sa.String(length=50), nullable=True),
        sa.Column("es_matriz", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)
    )
    op.create_index("ix_sucursal_codigo", "sucursal", ["codigo"])

    # 2. Insertar Sucursal Matriz predeterminada de forma idempotente
    op.execute("""
        INSERT INTO sucursal (id, codigo, nombre, direccion, es_matriz, activo) 
        VALUES ('00000000-0000-0000-0000-000000000001', 'MATRIZ', 'Sucursal Matriz (Principal)', 'Av. Central 100, Bodega Central', TRUE, TRUE)
        ON CONFLICT (codigo) DO NOTHING;
    """)

    # 3. Vincular sucursal_id a lote_inventario, sesion_caja y ventas
    op.add_column("lote_inventario", sa.Column("sucursal_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), server_default=sa.text("'00000000-0000-0000-0000-000000000001'"), nullable=True))
    op.add_column("sesion_caja", sa.Column("sucursal_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), server_default=sa.text("'00000000-0000-0000-0000-000000000001'"), nullable=True))
    op.add_column("ventas", sa.Column("sucursal_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), server_default=sa.text("'00000000-0000-0000-0000-000000000001'"), nullable=True))

    # 4. Crear ENUM EstadoTransferencia
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estadotransferencia') THEN CREATE TYPE estadotransferencia AS ENUM ('SOLICITADA', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA'); END IF; END $$;")
    tipo_enum = ENUM("SOLICITADA", "EN_TRANSITO", "RECIBIDA", "CANCELADA", name="estadotransferencia", create_type=False)

    # 5. Crear tabla transferencia_inventario
    op.create_table(
        "transferencia_inventario",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("folio", sa.String(length=50), nullable=False, unique=True),
        sa.Column("sucursal_origen_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), nullable=False),
        sa.Column("sucursal_destino_id", UUID(as_uuid=True), sa.ForeignKey("sucursal.id"), nullable=False),
        sa.Column("usuario_solicita_id", UUID(as_uuid=True), sa.ForeignKey("usuario.id"), nullable=False),
        sa.Column("usuario_recibe_id", UUID(as_uuid=True), sa.ForeignKey("usuario.id"), nullable=True),
        sa.Column("estado", tipo_enum, server_default=sa.text("'SOLICITADA'"), nullable=False),
        sa.Column("fecha_solicitud", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("fecha_despacho", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fecha_recepcion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True)
    )
    op.create_index("ix_transferencia_inventario_folio", "transferencia_inventario", ["folio"])
    op.create_index("ix_transferencia_inventario_origen", "transferencia_inventario", ["sucursal_origen_id"])
    op.create_index("ix_transferencia_inventario_destino", "transferencia_inventario", ["sucursal_destino_id"])

    # 6. Crear tabla detalle_transferencia
    op.create_table(
        "detalle_transferencia",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("transferencia_id", UUID(as_uuid=True), sa.ForeignKey("transferencia_inventario.id", ondelete="CASCADE"), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), sa.ForeignKey("producto.id"), nullable=False),
        sa.Column("lote_origen_id", UUID(as_uuid=True), sa.ForeignKey("lote_inventario.id"), nullable=True),
        sa.Column("cantidad", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("lote_destino_id", UUID(as_uuid=True), sa.ForeignKey("lote_inventario.id"), nullable=True)
    )
    op.create_index("ix_detalle_transferencia_transferencia_id", "detalle_transferencia", ["transferencia_id"])

def downgrade() -> None:
    op.drop_table("detalle_transferencia")
    op.drop_table("transferencia_inventario")
    op.execute("DROP TYPE IF EXISTS estadotransferencia;")
    op.drop_column("ventas", "sucursal_id")
    op.drop_column("sesion_caja", "sucursal_id")
    op.drop_column("lote_inventario", "sucursal_id")
    op.drop_table("sucursal")
