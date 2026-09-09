"""add cantidad_recibida to detalle_orden_compra

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from decimal import Decimal

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "detalle_orden_compra",
        sa.Column("cantidad_recibida", sa.Numeric(precision=10, scale=2), server_default="0.00", nullable=False)
    )

def downgrade() -> None:
    op.drop_column("detalle_orden_compra", "cantidad_recibida")
