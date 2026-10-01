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
    ListVehicleTypes,
    SetVehicleTypeEnabled,
    VerifyCourier,
)
from neirapp.modules.dispatch.application.deliveries import (
    CancelDelivery,
    ClaimDelivery,
    ConfirmDelivery,
    ConfirmPickup,
    GetDeliveryCourierUserIdRaw,
    GetDeliveryCustomerId,
    GetDeliveryForCustomer,
    GetEarningsSummary,
    GetMyActiveDelivery,
    GetMyCourierRating,
    GetReadyStoreOrderIds,
    ListAvailableDeliveries,
    ListCourierRatings,
    ListMyDeliveryHistory,
    RateCourier,
)
from neirapp.modules.dispatch.application.tracking import ListLiveCouriers, UpdateMyLocation
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
from neirapp.modules.identity.application.role_grants import (
    FindUserByEmail,
    GrantRoleByEmail,
    ListRoleGrants,
    ListUserIdsWithRole,
    RevokeRoleGrant,
)
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
from neirapp.modules.leads.application.app import LeadsApp
from neirapp.modules.leads.application.leads import ListLeads, SetLeadContacted, SubmitLead
from neirapp.modules.leads.infrastructure.store import SqlAlchemyLeadStore
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
from neirapp.modules.ordering.infrastructure.pricing_adapter import PricingFeeAdapter
from neirapp.modules.ordering.infrastructure.unit_of_work import (
    SqlAlchemyUnitOfWork as OrderingSqlAlchemyUnitOfWork,
)
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.pricing.application.app import PricingApp
from neirapp.modules.pricing.application.pricing import GetDeliveryPricing, UpdateDeliveryPricing
from neirapp.modules.pricing.infrastructure.store import SqlAlchemyPricingStore
from neirapp.modules.professionals.application.app import ProfessionalsApp
from neirapp.modules.professionals.application.categories import (
    AddSubcategory,
    CreateCategory,
    DeleteCategory,
    DeleteSubcategory,
    ListCategories,
    SetSubcategoryColor,
)
from neirapp.modules.professionals.application.profiles import (
    GetMyProfile,
    GetPublicProfile,
    ListDirectory,
    SaveMyProfile,
    SetFeatured,
)
from neirapp.modules.professionals.application.services import (
    AddService,
    DeleteService,
    ListMyServices,
    ListPublicServices,
    UpdateService,
)
from neirapp.modules.professionals.infrastructure.categories import SqlAlchemyCategoryRepository
from neirapp.modules.professionals.infrastructure.identity_adapter import IdentityAccessAdapter
from neirapp.modules.professionals.infrastructure.repositories import SqlAlchemyProfileRepository
from neirapp.modules.professionals.infrastructure.services import SqlAlchemyServiceRepository
from neirapp.modules.reviews.application.app import ReviewsApp
from neirapp.modules.reviews.application.reviews import (
    CreateReview,
    GetStoreRatingSummary,
    ListRatingSummaries,
    ListStoreReviews,
    ReplyToReview,
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
    AddClosedDate,
    AdminCreateStore,
    AdminUpdateStore,
    ClearStoreHours,
    CreateStore,
    GetMyStore,
    GetStore,
    GetStoreRaw,
    ListStores,
    RemoveClosedDate,
    SetRecommendedStores,
    SetStoreApproval,
    SetStoreHours,
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
        grant_role=GrantRoleByEmail(uow_factory, clock),
        revoke_role=RevokeRoleGrant(uow_factory),
        list_role_grants=ListRoleGrants(uow_factory),
        find_user_by_email=FindUserByEmail(uow_factory),
        list_user_ids_with_role=ListUserIdsWithRole(uow_factory),
    )


def build_stores(session_factory: async_sessionmaker[Any], clock: Clock | None = None) -> StoresApp:
    clock = clock or SystemClock()

    def uow_factory() -> StoresSqlAlchemyUnitOfWork:
        return StoresSqlAlchemyUnitOfWork(session_factory)

    return StoresApp(
        create_store=CreateStore(uow_factory, clock),
        admin_create_store=AdminCreateStore(uow_factory, clock),
        get_store=GetStore(uow_factory),
        list_stores=ListStores(uow_factory),
        update_store=UpdateStore(uow_factory),
        set_store_open=SetStoreOpen(uow_factory),
        set_store_approval=SetStoreApproval(uow_factory),
        set_recommended_stores=SetRecommendedStores(uow_factory),
        admin_update_store=AdminUpdateStore(uow_factory),
        get_my_store=GetMyStore(uow_factory),
        get_store_raw=GetStoreRaw(uow_factory),
        set_store_hours=SetStoreHours(uow_factory, clock),
        clear_store_hours=ClearStoreHours(uow_factory, clock),
        add_closed_date=AddClosedDate(uow_factory, clock),
        remove_closed_date=RemoveClosedDate(uow_factory, clock),
        clock=clock,
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
    pricing: PricingApp,
    clock: Clock | None = None,
) -> OrderingApp:
    clock = clock or SystemClock()

    def uow_factory() -> OrderingSqlAlchemyUnitOfWork:
        return OrderingSqlAlchemyUnitOfWork(session_factory)

    catalog = StoresCatalogAdapter(stores)
    gateway = FakePaymentGateway()

    return OrderingApp(
        create_order=CreateOrder(uow_factory, catalog, PricingFeeAdapter(pricing), clock),
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


def build_professionals(
    session_factory: async_sessionmaker[Any], identity: IdentityApp, clock: Clock | None = None
) -> ProfessionalsApp:
    repo = SqlAlchemyProfileRepository(session_factory)
    categories = SqlAlchemyCategoryRepository(session_factory)
    services = SqlAlchemyServiceRepository(session_factory)
    access = IdentityAccessAdapter(identity)
    clock = clock or SystemClock()
    return ProfessionalsApp(
        get_my_profile=GetMyProfile(repo),
        save_my_profile=SaveMyProfile(repo, categories, clock),
        list_directory=ListDirectory(repo, access),
        get_public_profile=GetPublicProfile(repo, access),
        set_featured=SetFeatured(repo),
        list_categories=ListCategories(categories),
        create_category=CreateCategory(categories),
        delete_category=DeleteCategory(categories, repo),
        add_subcategory=AddSubcategory(categories),
        set_subcategory_color=SetSubcategoryColor(categories),
        delete_subcategory=DeleteSubcategory(categories, repo),
        list_my_services=ListMyServices(services),
        add_service=AddService(services, clock),
        update_service=UpdateService(services, clock),
        delete_service=DeleteService(services),
        list_public_services=ListPublicServices(services, access),
    )


def build_leads(session_factory: async_sessionmaker[Any], clock: Clock | None = None) -> LeadsApp:
    store = SqlAlchemyLeadStore(session_factory)
    return LeadsApp(
        submit_lead=SubmitLead(store, clock or SystemClock()),
        list_leads=ListLeads(store),
        set_lead_contacted=SetLeadContacted(store),
    )


def build_pricing(session_factory: async_sessionmaker[Any]) -> PricingApp:
    store = SqlAlchemyPricingStore(session_factory)
    return PricingApp(
        get_delivery_pricing=GetDeliveryPricing(store),
        update_delivery_pricing=UpdateDeliveryPricing(store),
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
        list_vehicle_types=ListVehicleTypes(uow_factory),
        set_vehicle_type_enabled=SetVehicleTypeEnabled(uow_factory),
        list_available_deliveries=ListAvailableDeliveries(uow_factory, ordering_port),
        claim_delivery=ClaimDelivery(uow_factory, ordering_port, stores_port, clock),
        get_my_active_delivery=GetMyActiveDelivery(uow_factory),
        list_my_delivery_history=ListMyDeliveryHistory(uow_factory),
        get_ready_store_order_ids=GetReadyStoreOrderIds(ordering_port),
        get_delivery_customer_id=GetDeliveryCustomerId(ordering_port),
        get_earnings_summary=GetEarningsSummary(uow_factory),
        rate_courier=RateCourier(uow_factory, ordering_port, clock),
        get_my_courier_rating=GetMyCourierRating(uow_factory),
        list_courier_ratings=ListCourierRatings(uow_factory),
        update_my_location=UpdateMyLocation(uow_factory, clock),
        list_live_couriers=ListLiveCouriers(uow_factory, clock),
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
        list_rating_summaries=ListRatingSummaries(uow_factory),
        reply_to_review=ReplyToReview(uow_factory, ordering_port, clock),
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
