"""add cedula to clientes table

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("clientes", sa.Column("cedula", sa.String(length=30), nullable=True))
    op.create_index(op.f("ix_clientes_cedula"), "clientes", ["cedula"], unique=True)

def downgrade() -> None:
    op.drop_index(op.f("ix_clientes_cedula"), table_name="clientes")
    op.drop_column("clientes", "cedula")
