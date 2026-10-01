from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fastapi import Depends, FastAPI

from neirapp.bootstrap.app import create_app
from neirapp.bootstrap.models import Base
from neirapp.bootstrap.settings import Settings
from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles


class FakeClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 9, 21, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def db_url(tmp_path: Path) -> str:
    return f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
def make_settings(db_url: str, tmp_path: Path) -> Callable[..., Settings]:
    def factory(**overrides: object) -> Settings:
        return Settings(
            environment="test",
            database_url=db_url,
            uploads_dir=str(tmp_path / "uploads"),
            cors_origins=[],
            **overrides,  # type: ignore[arg-type]
        )

    return factory


def _add_test_routes(app: FastAPI) -> None:
    @app.get("/_test/admin-only")
    async def admin_only(user: User = Depends(require_roles(Role.ADMIN))) -> dict[str, str]:  # noqa: B008
        return {"user": user.email}


@pytest.fixture
async def app(make_settings: Callable[..., Settings], clock: FakeClock) -> AsyncIterator[FastAPI]:
    app = create_app(make_settings(), clock=clock)
    _add_test_routes(app)
    async with app.state.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield app
    await app.state.engine.dispose()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
