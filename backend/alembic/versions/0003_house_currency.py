"""house currency

Revision ID: 0003_house_currency
Revises: 0002_houses
Create Date: 2026-06-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_house_currency"
down_revision: Union[str, None] = "0002_houses"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "houses",
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
    )


def downgrade() -> None:
    op.drop_column("houses", "currency")
