import asyncio
from typing import Any

from alembic import context
from sqlalchemy.engine import Connection

from neirapp.bootstrap.models import Base
from neirapp.bootstrap.settings import Settings
from neirapp.shared.infrastructure.db import UTCDateTime, create_engine

target_metadata = Base.metadata


def _render_item(type_: str, obj: Any, autogen_context: Any) -> str | bool:
    """Las migraciones no deben importar código de la app: UTCDateTime es un DateTime con tz."""
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime(timezone=True)"
    return False


def _database_url() -> str:
    return Settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_item=_render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_item=_render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_engine(_database_url())
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
