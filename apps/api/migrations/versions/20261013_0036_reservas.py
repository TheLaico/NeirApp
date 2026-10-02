"""Reservas: lugares que se reservan (restaurantes, canchas, salones…), reseñas y reservas

Revision ID: 0036
Revises: 0035
Create Date: 2026-10-13 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "venues_venue",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("tagline", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("address", sa.String(120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("phone", sa.String(10), nullable=False),
        sa.Column("whatsapp", sa.String(10), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("photos", sa.JSON(), nullable=False),
        sa.Column("open_time", sa.String(5), nullable=False),
        sa.Column("close_time", sa.String(5), nullable=False),
        sa.Column("open_days", sa.JSON(), nullable=False),
        sa.Column("max_people", sa.Integer(), nullable=False),
        sa.Column("price_cop", sa.Integer(), nullable=False),
        sa.Column("price_unit", sa.String(10), nullable=False),
        sa.Column("is_listed", sa.Boolean(), nullable=False),
        sa.Column("is_featured", sa.Boolean(), nullable=False),
        sa.Column("banner_url", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "venues_review",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("venue_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("reply", sa.Text(), nullable=False),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("venue_id", "user_id", name="uq_venues_review_author"),
    )
    op.create_table(
        "venues_booking",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("venue_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(10), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("at", sa.String(5), nullable=False),
        sa.Column("people", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("venue_note", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("venues_booking")
    op.drop_table("venues_review")
    op.drop_table("venues_venue")
