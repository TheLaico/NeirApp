"""Composition root: el único lugar donde se conectan puertos con adaptadores concretos."""

from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.bootstrap.settings import Settings
from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.application.dto import TermsPolicy
from neirapp.modules.identity.application.profile import (
    AcceptTerms,
    AuthenticateAccessToken,
    GetProfile,
    UpdateProfile,
)
from neirapp.modules.identity.application.registration import RegisterUser
from neirapp.modules.identity.application.session_issuer import SessionIssuer
from neirapp.modules.identity.application.sessions import Login, Logout, RefreshSession
from neirapp.modules.identity.domain.entities import TermsDocument
from neirapp.modules.identity.infrastructure.security import Argon2PasswordHasher, JwtTokenService
from neirapp.modules.identity.infrastructure.unit_of_work import SqlAlchemyUnitOfWork
from neirapp.modules.stores.application.app import StoresApp
from neirapp.modules.stores.application.products import (
    CreateProduct,
    DeleteProduct,
    ListStoreProducts,
    SearchProducts,
    SetProductAvailability,
    UpdateProduct,
)
from neirapp.modules.stores.application.stores import (
    CreateStore,
    GetMyStore,
    GetStore,
    ListStores,
    SetStoreOpen,
    UpdateStore,
)
from neirapp.modules.stores.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as StoresSqlAlchemyUnitOfWork,
)
from neirapp.shared.application.ports import Clock
from neirapp.shared.infrastructure.clock import SystemClock


def build_identity(
    settings: Settings, session_factory: async_sessionmaker[Any], clock: Clock | None = None
) -> IdentityApp:
    clock = clock or SystemClock()

    def uow_factory() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(session_factory)

    tokens = JwtTokenService(
        secret=settings.jwt_secret.get_secret_value(),
        issuer=settings.jwt_issuer,
        access_ttl=timedelta(minutes=settings.access_token_ttl_minutes),
    )
    hasher = Argon2PasswordHasher()
    sessions = SessionIssuer(tokens, refresh_ttl=timedelta(days=settings.refresh_token_ttl_days))
    policy = TermsPolicy(
        {
            TermsDocument.TERMS_AND_CONDITIONS: settings.terms_version,
            TermsDocument.PRIVACY_POLICY: settings.privacy_version,
        }
    )

    return IdentityApp(
        register=RegisterUser(uow_factory, hasher, sessions, policy, clock),
        login=Login(uow_factory, hasher, sessions, policy, clock),
        refresh=RefreshSession(uow_factory, sessions, policy, clock),
        logout=Logout(uow_factory, clock),
        authenticate=AuthenticateAccessToken(uow_factory, tokens, clock),
        get_profile=GetProfile(uow_factory, policy),
        update_profile=UpdateProfile(uow_factory, policy),
        accept_terms=AcceptTerms(uow_factory, policy, clock),
        terms_policy=policy,
    )


def build_stores(session_factory: async_sessionmaker[Any], clock: Clock | None = None) -> StoresApp:
    clock = clock or SystemClock()

    def uow_factory() -> StoresSqlAlchemyUnitOfWork:
        return StoresSqlAlchemyUnitOfWork(session_factory)

    return StoresApp(
        create_store=CreateStore(uow_factory, clock),
        get_store=GetStore(uow_factory),
        list_stores=ListStores(uow_factory),
        update_store=UpdateStore(uow_factory),
        set_store_open=SetStoreOpen(uow_factory),
        get_my_store=GetMyStore(uow_factory),
        create_product=CreateProduct(uow_factory, clock),
        list_store_products=ListStoreProducts(uow_factory),
        update_product=UpdateProduct(uow_factory),
        set_product_availability=SetProductAvailability(uow_factory),
        delete_product=DeleteProduct(uow_factory),
        search_products=SearchProducts(uow_factory),
    )
