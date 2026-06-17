"""price_determined_at

Revision ID: 0004_price_determined_at
Revises: 0003_house_currency
Create Date: 2026-06-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_price_determined_at"
down_revision: Union[str, None] = "0003_house_currency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("price_determined_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("items", "price_determined_at")
