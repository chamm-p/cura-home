"""item category

Revision ID: 0005_item_category
Revises: 0004_price_determined_at
Create Date: 2026-06-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_item_category"
down_revision: Union[str, None] = "0004_price_determined_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("category", sa.String(40), nullable=True))
    op.create_index("ix_items_category", "items", ["category"])


def downgrade() -> None:
    op.drop_index("ix_items_category", table_name="items")
    op.drop_column("items", "category")
