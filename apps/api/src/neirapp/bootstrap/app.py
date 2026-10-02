from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from neirapp.bootstrap.container import (
    build_dispatch,
    build_identity,
    build_incidents,
    build_leads,
    build_lodging,
    build_marketplace,
    build_ordering,
    build_pricing,
    build_professionals,
    build_reviews,
    build_rides,
    build_stores,
    build_suppliers,
    build_venues,
    build_wallet,
)
from neirapp.bootstrap.settings import Settings
from neirapp.modules.dispatch.presentation.router import router as dispatch_router
from neirapp.modules.identity.presentation.router import router as identity_router
from neirapp.modules.incidents.presentation.router import router as incidents_router
from neirapp.modules.leads.presentation.router import router as leads_router
from neirapp.modules.lodging.presentation.router import router as lodging_router
from neirapp.modules.marketplace.presentation.router import router as marketplace_router
from neirapp.modules.media.presentation.router import router as media_router
from neirapp.modules.ordering.presentation.router import router as ordering_router
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.pricing.presentation.router import router as pricing_router
from neirapp.modules.professionals.presentation.notifications_router import (
    router as notifications_router,
)
from neirapp.modules.professionals.presentation.router import router as professionals_router
from neirapp.modules.reviews.presentation.router import router as reviews_router
from neirapp.modules.rides.presentation.router import router as rides_router
from neirapp.modules.stores.presentation.router import router as stores_router
from neirapp.modules.suppliers.presentation.router import router as suppliers_router
from neirapp.modules.venues.presentation.router import router as venues_router
from neirapp.modules.wallet.presentation.router import router as wallet_router
from neirapp.shared.application.ports import Clock
from neirapp.shared.infrastructure.db import create_engine, create_session_factory
from neirapp.shared.presentation.errors import register_exception_handlers


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = create_engine(settings.database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(
        title="NeirApp API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.environment == "production" else "/docs",
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.identity = build_identity(settings, session_factory, clock)
    app.state.stores = build_stores(session_factory, clock)
    app.state.order_notifications = ConnectionManager()
    app.state.pricing = build_pricing(session_factory)
    app.state.leads = build_leads(session_factory, clock)
    app.state.professionals = build_professionals(session_factory, app.state.identity, clock)
    app.state.suppliers = build_suppliers(
        session_factory, app.state.identity, app.state.professionals, clock
    )
    app.state.lodging = build_lodging(
        session_factory, app.state.identity, app.state.professionals, clock
    )
    app.state.venues = build_venues(
        session_factory, app.state.identity, app.state.professionals, clock
    )
    app.state.rides = build_rides(
        session_factory, app.state.identity, app.state.professionals, clock
    )
    app.state.marketplace = build_marketplace(
        session_factory, app.state.identity, app.state.professionals, clock
    )
    app.state.ordering = build_ordering(
        session_factory,
        app.state.stores,
        app.state.order_notifications,
        app.state.pricing,
        clock,
    )
    app.state.wallet = build_wallet(session_factory, clock)
    app.state.dispatch = build_dispatch(
        session_factory, app.state.stores, app.state.ordering, app.state.wallet, clock
    )
    app.state.reviews = build_reviews(session_factory, app.state.ordering, clock)
    app.state.incidents = build_incidents(
        session_factory, app.state.ordering, app.state.dispatch, clock
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(identity_router, prefix="/api/v1")
    app.include_router(stores_router, prefix="/api/v1")
    app.include_router(ordering_router, prefix="/api/v1")
    app.include_router(wallet_router, prefix="/api/v1")
    app.include_router(pricing_router, prefix="/api/v1")
    app.include_router(leads_router, prefix="/api/v1")
    app.include_router(professionals_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(marketplace_router, prefix="/api/v1")
    app.include_router(suppliers_router, prefix="/api/v1")
    app.include_router(lodging_router, prefix="/api/v1")
    app.include_router(venues_router, prefix="/api/v1")
    app.include_router(rides_router, prefix="/api/v1")
    app.include_router(dispatch_router, prefix="/api/v1")
    app.include_router(reviews_router, prefix="/api/v1")
    app.include_router(incidents_router, prefix="/api/v1")
    app.include_router(media_router, prefix="/api/v1")
    return app
