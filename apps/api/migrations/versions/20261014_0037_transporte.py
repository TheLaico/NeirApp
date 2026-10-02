"""Transporte: conductores de motocarro y viajes en tiempo real

Revision ID: 0037
Revises: 0036
Create Date: 2026-10-14 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: str | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rides_driver",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("phone", sa.String(10), nullable=False),
        sa.Column("plate", sa.String(7), nullable=False),
        sa.Column("vehicle_model", sa.String(60), nullable=False),
        sa.Column("model_year", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(30), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("photo_url", sa.String(300), nullable=False),
        sa.Column("vehicle_photo_url", sa.String(300), nullable=False),
        sa.Column("is_online", sa.Boolean(), nullable=False, index=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("located_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "rides_ride",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("customer_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_name", sa.String(120), nullable=False),
        sa.Column("customer_phone", sa.String(20), nullable=False),
        sa.Column("passengers", sa.Integer(), nullable=False),
        sa.Column("pickup_lat", sa.Float(), nullable=False),
        sa.Column("pickup_lng", sa.Float(), nullable=False),
        sa.Column("address", sa.String(120), nullable=False),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("destination", sa.String(120), nullable=False),
        sa.Column("fare_cop", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, index=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("driver_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", sa.String(10), nullable=False),
        sa.Column("customer_lat", sa.Float(), nullable=True),
        sa.Column("customer_lng", sa.Float(), nullable=True),
        sa.Column("customer_located_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("rating_comment", sa.String(300), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("rides_ride")
    op.drop_table("rides_driver")
