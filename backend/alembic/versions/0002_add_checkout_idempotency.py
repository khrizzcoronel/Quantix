"""add checkout idempotency

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ventas", sa.Column("idempotency_key", sa.String(length=64), nullable=True))
    op.create_index("ix_ventas_idempotency_key", "ventas", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_ventas_idempotency_key", table_name="ventas")
    op.drop_column("ventas", "idempotency_key")
