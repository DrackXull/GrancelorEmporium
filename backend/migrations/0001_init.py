"""init schema

Revision ID: 0001_init
Revises:
Create Date: 2025-10-24 00:00:00.000000
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("class",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("ruleset", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("hit_die", sa.String(), nullable=True),
        sa.Column("hp_per_level", sa.Integer(), nullable=True),
        sa.Column("primary_stat", sa.String(), nullable=True),
        sa.Column("subclass_unlock", sa.Integer(), nullable=True),
        sa.Column("casting_stat", sa.String(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("subclass",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("class_id", sa.String(), sa.ForeignKey("class.id"), index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("feature",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_type", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), index=True),
        sa.Column("level", sa.Integer(), index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("weapon",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("group", sa.String(), index=True),
        sa.Column("traits", sa.String(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("armor",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("category", sa.String(), index=True),
        sa.Column("ac_base", sa.Integer(), nullable=True),
        sa.Column("dex_cap", sa.Integer(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("feat",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("level", sa.Integer(), index=True),
        sa.Column("tags", sa.String(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("spell",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("level", sa.Integer(), index=True),
        sa.Column("school", sa.String(), index=True),
        sa.Column("class_tags", sa.String(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("background",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("ancestry",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), index=True),
        sa.Column("hp", sa.Integer(), nullable=True),
        sa.Column("json", sa.JSON(), nullable=False),
    )
    op.create_table("pf2etier",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("class_id", sa.String(), index=True),
        sa.Column("target_id", sa.String(), index=True),
        sa.Column("target_kind", sa.String(), index=True),
        sa.Column("default_tier", sa.String(), nullable=True),
        sa.Column("by_level_json", sa.JSON(), nullable=True),
        sa.Column("overrides_json", sa.JSON(), nullable=True),
    )
    op.create_table("defaultconfig",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("class_id", sa.String(), index=True),
        sa.Column("ruleset", sa.String(), index=True),
        sa.Column("payload_json", sa.JSON(), nullable=False),
    )

def downgrade() -> None:
    for t in [
        "defaultconfig","pf2etier","ancestry","background","spell","feat",
        "armor","weapon","feature","subclass","class"
    ]:
        op.drop_table(t)
