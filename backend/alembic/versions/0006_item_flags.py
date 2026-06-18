"""item flags: for_sale, for_disposal, needs_verification

Revision ID: 0006_item_flags
Revises: 0005_item_category
Create Date: 2026-06-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_item_flags"
down_revision: Union[str, None] = "0005_item_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("for_sale", sa.Boolean, nullable=False, server_default=sa.false()))
    op.add_column("items", sa.Column("for_disposal", sa.Boolean, nullable=False, server_default=sa.false()))
    op.add_column(
        "items",
        sa.Column("needs_verification", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_items_needs_verification", "items", ["needs_verification"])


def downgrade() -> None:
    op.drop_index("ix_items_needs_verification", table_name="items")
    op.drop_column("items", "needs_verification")
    op.drop_column("items", "for_disposal")
    op.drop_column("items", "for_sale")
