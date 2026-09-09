"""add telefono to usuario

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuario", sa.Column("telefono", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("usuario", "telefono")
