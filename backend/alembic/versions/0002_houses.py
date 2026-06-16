"""houses + house_members, area/item house scoping

Revision ID: 0002_houses
Revises: 0001_initial
Create Date: 2026-06-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_houses"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    house_role = postgresql.ENUM("owner", "member", name="house_role")

    op.create_table(
        "houses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_houses_owner_id", "houses", ["owner_id"])

    op.create_table(
        "house_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "house_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("houses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", house_role, nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("house_id", "user_id", name="uq_house_members_house_user"),
    )
    op.create_index("ix_house_members_house_id", "house_members", ["house_id"])
    op.create_index("ix_house_members_user_id", "house_members", ["user_id"])

    # Bereiche + Objekte an ein Haus binden. Tabellen sind leer (kein Bestand),
    # daher NOT NULL ohne Backfill möglich.
    op.add_column(
        "areas",
        sa.Column(
            "house_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("houses.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_areas_house_id", "areas", ["house_id"])

    op.add_column(
        "items",
        sa.Column(
            "house_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("houses.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_items_house_id", "items", ["house_id"])


def downgrade() -> None:
    op.drop_index("ix_items_house_id", table_name="items")
    op.drop_column("items", "house_id")
    op.drop_index("ix_areas_house_id", table_name="areas")
    op.drop_column("areas", "house_id")
    op.drop_index("ix_house_members_user_id", table_name="house_members")
    op.drop_index("ix_house_members_house_id", table_name="house_members")
    op.drop_table("house_members")
    op.drop_index("ix_houses_owner_id", table_name="houses")
    op.drop_table("houses")
    op.execute("DROP TYPE IF EXISTS house_role")
