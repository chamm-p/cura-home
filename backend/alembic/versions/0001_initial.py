"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = postgresql.ENUM("admin", "user", name="user_role")
    price_source = postgresql.ENUM("manual", "llm", "websearch", name="price_source")
    field_type = postgresql.ENUM("checkbox", "text", name="custom_field_type")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(150), nullable=False),
        sa.Column("oidc_subject", sa.String(255), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("first_name", sa.String(150), nullable=True),
        sa.Column("last_name", sa.String(150), nullable=True),
        sa.Column("full_name", sa.String(300), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("settings", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_oidc_subject", "users", ["oidc_subject"], unique=True)

    op.create_table(
        "areas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "area_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("areas.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(300), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("price_new", sa.Numeric(12, 2), nullable=True),
        sa.Column("price_source", price_source, nullable=True),
        sa.Column("is_catalogued", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("custom_values", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_items_area_id", "items", ["area_id"])

    op.create_table(
        "item_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_item_photos_item_id", "item_photos", ["item_id"])

    op.create_table(
        "custom_field_defs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(80), nullable=False, unique=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("field_type", field_type, nullable=False, server_default="text"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "custom_field_values",
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "field_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("custom_field_defs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("value", sa.String(2000), nullable=True),
    )

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.create_table(
        "llm_backends",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("api_base_url", sa.String(500), nullable=False),
        sa.Column("api_key_encrypted", sa.String(1000), nullable=True),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("capabilities", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("llm_backends")
    op.drop_table("system_settings")
    op.drop_table("custom_field_values")
    op.drop_table("custom_field_defs")
    op.drop_index("ix_item_photos_item_id", table_name="item_photos")
    op.drop_table("item_photos")
    op.drop_index("ix_items_area_id", table_name="items")
    op.drop_table("items")
    op.drop_table("areas")
    op.drop_index("ix_users_oidc_subject", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    for enum_name in ("custom_field_type", "price_source", "user_role"):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
