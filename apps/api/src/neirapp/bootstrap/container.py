"""Composition root: el único lugar donde se conectan puertos con adaptadores concretos."""

from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.bootstrap.settings import Settings
from neirapp.modules.dispatch.application.app import DispatchApp
from neirapp.modules.dispatch.application.couriers import (
    CreateCourierProfile,
    GetMyCourierProfile,
    ListPendingCouriers,
    VerifyCourier,
)
from neirapp.modules.dispatch.application.deliveries import (
    CancelDelivery,
    ClaimDelivery,
    ConfirmDelivery,
    ConfirmPickup,
    GetDeliveryCourierUserIdRaw,
    GetDeliveryForCustomer,
    GetMyActiveDelivery,
    ListAvailableDeliveries,
    ListMyDeliveryHistory,
)
from neirapp.modules.dispatch.infrastructure.ordering_adapter import OrderingAdapter
from neirapp.modules.dispatch.infrastructure.stores_adapter import StoresAdapter
from neirapp.modules.dispatch.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as DispatchSqlAlchemyUnitOfWork,
)
from neirapp.modules.dispatch.infrastructure.wallet_adapter import WalletAdapter
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
from neirapp.modules.incidents.application.app import IncidentsApp
from neirapp.modules.incidents.application.incidents import (
    ListIncidents,
    ListMyIncidents,
    ReportIncident,
    ResolveIncident,
)
from neirapp.modules.incidents.infrastructure.dispatch_adapter import (
    DispatchAdapter as IncidentsDispatchAdapter,
)
from neirapp.modules.incidents.infrastructure.ordering_adapter import (
    OrderingAdapter as IncidentsOrderingAdapter,
)
from neirapp.modules.incidents.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as IncidentsSqlAlchemyUnitOfWork,
)
from neirapp.modules.ordering.application.app import OrderingApp
from neirapp.modules.ordering.application.orders import (
    AcceptStoreOrder,
    CreateOrder,
    GetOrder,
    GetOrderRaw,
    GetStoreOrderViewRaw,
    ListClaimableOrders,
    ListMyOrders,
    ListStoreOrders,
    MarkStoreOrderHandedOverRaw,
    MarkStoreOrderReady,
    PayOrder,
    RejectStoreOrder,
    StartPreparingStoreOrder,
)
from neirapp.modules.ordering.infrastructure.catalog_adapter import StoresCatalogAdapter
from neirapp.modules.ordering.infrastructure.fake_payment_gateway import FakePaymentGateway
from neirapp.modules.ordering.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as OrderingSqlAlchemyUnitOfWork,
)
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.reviews.application.app import ReviewsApp
from neirapp.modules.reviews.application.reviews import (
    CreateReview,
    GetStoreRatingSummary,
    ListStoreReviews,
)
from neirapp.modules.reviews.infrastructure.ordering_adapter import (
    OrderingAdapter as ReviewsOrderingAdapter,
)
from neirapp.modules.reviews.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as ReviewsSqlAlchemyUnitOfWork,
)
from neirapp.modules.stores.application.app import StoresApp
from neirapp.modules.stores.application.products import (
    CreateProduct,
    DeleteProduct,
    GetProductRaw,
    ListStoreProducts,
    SearchProducts,
    SetProductAvailability,
    UpdateProduct,
)
from neirapp.modules.stores.application.stores import (
    CreateStore,
    GetMyStore,
    GetStore,
    GetStoreRaw,
    ListStores,
    SetStoreApproval,
    SetStoreOpen,
    UpdateStore,
)
from neirapp.modules.stores.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as StoresSqlAlchemyUnitOfWork,
)
from neirapp.modules.wallet.application.app import WalletApp
from neirapp.modules.wallet.application.wallet import (
    CreditCourier,
    GetBalance,
    ListLedger,
    RequestWithdrawal,
)
from neirapp.modules.wallet.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as WalletSqlAlchemyUnitOfWork,
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
        set_store_approval=SetStoreApproval(uow_factory),
        get_my_store=GetMyStore(uow_factory),
        get_store_raw=GetStoreRaw(uow_factory),
        create_product=CreateProduct(uow_factory, clock),
        list_store_products=ListStoreProducts(uow_factory),
        update_product=UpdateProduct(uow_factory),
        set_product_availability=SetProductAvailability(uow_factory),
        delete_product=DeleteProduct(uow_factory),
        search_products=SearchProducts(uow_factory),
        get_product_raw=GetProductRaw(uow_factory),
    )


def build_ordering(
    session_factory: async_sessionmaker[Any],
    stores: StoresApp,
    notifier: ConnectionManager,
    clock: Clock | None = None,
) -> OrderingApp:
    clock = clock or SystemClock()

    def uow_factory() -> OrderingSqlAlchemyUnitOfWork:
        return OrderingSqlAlchemyUnitOfWork(session_factory)

    catalog = StoresCatalogAdapter(stores)
    gateway = FakePaymentGateway()

    return OrderingApp(
        create_order=CreateOrder(uow_factory, catalog, clock),
        get_order=GetOrder(uow_factory),
        list_my_orders=ListMyOrders(uow_factory),
        pay_order=PayOrder(uow_factory, gateway, notifier, clock),
        list_store_orders=ListStoreOrders(uow_factory, catalog),
        accept_store_order=AcceptStoreOrder(uow_factory, clock),
        reject_store_order=RejectStoreOrder(uow_factory, clock),
        start_preparing_store_order=StartPreparingStoreOrder(uow_factory, clock),
        mark_store_order_ready=MarkStoreOrderReady(uow_factory, clock),
        get_order_raw=GetOrderRaw(uow_factory),
        list_claimable_orders=ListClaimableOrders(uow_factory),
        mark_store_order_handed_over_raw=MarkStoreOrderHandedOverRaw(uow_factory, clock),
        get_store_order_view_raw=GetStoreOrderViewRaw(uow_factory),
    )


def build_wallet(session_factory: async_sessionmaker[Any], clock: Clock | None = None) -> WalletApp:
    clock = clock or SystemClock()

    def uow_factory() -> WalletSqlAlchemyUnitOfWork:
        return WalletSqlAlchemyUnitOfWork(session_factory)

    return WalletApp(
        credit_courier=CreditCourier(uow_factory, clock),
        get_balance=GetBalance(uow_factory),
        list_ledger=ListLedger(uow_factory),
        request_withdrawal=RequestWithdrawal(uow_factory, clock),
    )


def build_dispatch(
    session_factory: async_sessionmaker[Any],
    stores: StoresApp,
    ordering: OrderingApp,
    wallet: WalletApp,
    clock: Clock | None = None,
) -> DispatchApp:
    clock = clock or SystemClock()

    def uow_factory() -> DispatchSqlAlchemyUnitOfWork:
        return DispatchSqlAlchemyUnitOfWork(session_factory)

    stores_port = StoresAdapter(stores)
    ordering_port = OrderingAdapter(ordering)
    wallet_port = WalletAdapter(wallet)

    return DispatchApp(
        create_courier_profile=CreateCourierProfile(uow_factory, clock),
        get_my_courier_profile=GetMyCourierProfile(uow_factory),
        list_pending_couriers=ListPendingCouriers(uow_factory),
        verify_courier=VerifyCourier(uow_factory),
        list_available_deliveries=ListAvailableDeliveries(uow_factory, ordering_port),
        claim_delivery=ClaimDelivery(uow_factory, ordering_port, stores_port, clock),
        get_my_active_delivery=GetMyActiveDelivery(uow_factory),
        list_my_delivery_history=ListMyDeliveryHistory(uow_factory),
        confirm_pickup=ConfirmPickup(uow_factory, ordering_port, clock),
        confirm_delivery=ConfirmDelivery(uow_factory, wallet_port, clock),
        cancel_delivery=CancelDelivery(uow_factory, clock),
        get_delivery_for_customer=GetDeliveryForCustomer(uow_factory, ordering_port),
        get_delivery_courier_user_id_raw=GetDeliveryCourierUserIdRaw(uow_factory),
    )


def build_reviews(
    session_factory: async_sessionmaker[Any], ordering: OrderingApp, clock: Clock | None = None
) -> ReviewsApp:
    clock = clock or SystemClock()

    def uow_factory() -> ReviewsSqlAlchemyUnitOfWork:
        return ReviewsSqlAlchemyUnitOfWork(session_factory)

    ordering_port = ReviewsOrderingAdapter(ordering)

    return ReviewsApp(
        create_review=CreateReview(uow_factory, ordering_port, clock),
        list_store_reviews=ListStoreReviews(uow_factory),
        get_store_rating_summary=GetStoreRatingSummary(uow_factory),
    )


def build_incidents(
    session_factory: async_sessionmaker[Any],
    ordering: OrderingApp,
    dispatch: DispatchApp,
    clock: Clock | None = None,
) -> IncidentsApp:
    clock = clock or SystemClock()

    def uow_factory() -> IncidentsSqlAlchemyUnitOfWork:
        return IncidentsSqlAlchemyUnitOfWork(session_factory)

    ordering_port = IncidentsOrderingAdapter(ordering)
    dispatch_port = IncidentsDispatchAdapter(dispatch)

    return IncidentsApp(
        report_incident=ReportIncident(uow_factory, ordering_port, dispatch_port, clock),
        list_my_incidents=ListMyIncidents(uow_factory),
        list_incidents=ListIncidents(uow_factory),
        resolve_incident=ResolveIncident(uow_factory, clock),
    )
