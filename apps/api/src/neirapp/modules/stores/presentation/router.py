import contextlib
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import (
    CurrentUser,
    IdentityDep,
    require_roles,
)
from neirapp.modules.stores.application.products import (
    CreateProductCommand,
    SearchProductsQuery,
)
from neirapp.modules.stores.application.stores import CreateStoreCommand
from neirapp.modules.stores.domain.entities import Store, StoreCategory
from neirapp.modules.stores.domain.errors import (
    InvalidStorePosition,
    StoreOwnerNotMerchant,
    StoreOwnerNotRegistered,
)
from neirapp.modules.stores.domain.schedule import DayHours
from neirapp.modules.stores.presentation.dependencies import StoresDep
from neirapp.modules.stores.presentation.schemas import (
    AdminCreateStoreRequest,
    AdminStoreResponse,
    AdminUpdateStoreRequest,
    ClosedDateRequest,
    CreateProductRequest,
    CreateStoreRequest,
    ProductResponse,
    ScheduleResponse,
    SearchResultResponse,
    SetProductAvailabilityRequest,
    SetRecommendedStoresRequest,
    SetStoreApprovalRequest,
    SetStoreOpenRequest,
    StoreResponse,
    UpdateProductRequest,
    UpdateScheduleRequest,
    UpdateStoreRequest,
)

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(tags=["stores"])


# --- Tiendas ---------------------------------------------------------------


@router.post("/stores", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    body: CreateStoreRequest, user: CurrentUser, stores: StoresDep
) -> StoreResponse:
    store = await stores.create_store(
        user.id,
        CreateStoreCommand(
            name=body.name,
            category=body.category,
            description=body.description,
            lat=body.lat,
            lng=body.lng,
        ),
    )
    return StoreResponse.from_domain(stores.clock.now(), store)


@router.post("/admin/stores", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_store(
    body: AdminCreateStoreRequest,
    _admin: RequireAdmin,
    stores: StoresDep,
    identity: IdentityDep,
) -> StoreResponse:
    """Un admin crea la tienda de un comerciante (por su correo). Nace aprobada."""
    owner = await identity.find_user_by_email(body.owner_email)
    if owner is None:
        raise StoreOwnerNotRegistered()
    if not owner.has_any_role(Role.STORE_STAFF):
        raise StoreOwnerNotMerchant()
    store = await stores.admin_create_store(
        owner.id,
        CreateStoreCommand(
            name=body.name,
            category=body.category,
            description=body.description,
            lat=body.lat,
            lng=body.lng,
        ),
    )
    return StoreResponse.from_domain(stores.clock.now(), store)


async def _admin_view(stores: StoresDep, identity: IdentityDep, store: Store) -> AdminStoreResponse:
    email = ""
    with contextlib.suppress(Exception):  # un dueño borrado no rompe el panel
        email = (await identity.get_profile(store.owner_user_id)).user.email
    base = StoreResponse.from_domain(stores.clock.now(), store)
    return AdminStoreResponse(**base.model_dump(), owner_email=email)


@router.get("/admin/stores", response_model=list[AdminStoreResponse])
async def admin_list_stores(
    _admin: RequireAdmin, stores: StoresDep, identity: IdentityDep
) -> list[AdminStoreResponse]:
    """Todas las tiendas (también las ocultas y las pendientes), con el correo de su dueño."""
    every = await stores.list_stores(is_approved=None, is_listed=None)
    return [await _admin_view(stores, identity, s) for s in every]


@router.patch("/admin/stores/{store_id}", response_model=AdminStoreResponse)
async def admin_update_store(
    store_id: UUID,
    body: AdminUpdateStoreRequest,
    _admin: RequireAdmin,
    stores: StoresDep,
    identity: IdentityDep,
) -> AdminStoreResponse:
    """Cambia el dueño (por correo), la posición y si la tienda aparece en el mapa."""
    owner_id: UUID | None = None
    if body.owner_email is not None:
        owner = await identity.find_user_by_email(body.owner_email)
        if owner is None:
            raise StoreOwnerNotRegistered()
        if not owner.has_any_role(Role.STORE_STAFF):
            raise StoreOwnerNotMerchant()
        owner_id = owner.id
    if (body.lat is None) != (body.lng is None):
        raise InvalidStorePosition()
    store = await stores.admin_update_store(
        store_id, owner_user_id=owner_id, lat=body.lat, lng=body.lng, is_listed=body.is_listed
    )
    return await _admin_view(stores, identity, store)


@router.get("/stores", response_model=list[StoreResponse])
async def list_stores(
    stores: StoresDep, category: StoreCategory | None = None
) -> list[StoreResponse]:
    result = await stores.list_stores(category=category)
    return [StoreResponse.from_domain(stores.clock.now(), s) for s in result]


@router.get("/stores/me", response_model=StoreResponse | None)
async def my_store(user: CurrentUser, stores: StoresDep) -> StoreResponse | None:
    store = await stores.get_my_store(user.id)
    return StoreResponse.from_domain(stores.clock.now(), store) if store else None


@router.get("/stores/pending", response_model=list[StoreResponse])
async def list_pending_stores(_admin: RequireAdmin, stores: StoresDep) -> list[StoreResponse]:
    """Backoffice: tiendas que un admin todavía no ha aprobado ni rechazado."""
    result = await stores.list_stores(is_approved=False, is_listed=None)
    return [StoreResponse.from_domain(stores.clock.now(), s) for s in result]


@router.get("/stores/{store_id}", response_model=StoreResponse)
async def get_store(store_id: UUID, stores: StoresDep) -> StoreResponse:
    return StoreResponse.from_domain(stores.clock.now(), await stores.get_store(store_id))


@router.patch("/stores/{store_id}", response_model=StoreResponse)
async def update_store(
    store_id: UUID, body: UpdateStoreRequest, user: CurrentUser, stores: StoresDep
) -> StoreResponse:
    store = await stores.update_store(
        store_id,
        user.id,
        name=body.name,
        category=body.category,
        description=body.description,
        image_url=body.image_url,
        logo_url=body.logo_url,
    )
    return StoreResponse.from_domain(stores.clock.now(), store)


@router.patch("/stores/{store_id}/open", response_model=StoreResponse)
async def set_store_open(
    store_id: UUID, body: SetStoreOpenRequest, user: CurrentUser, stores: StoresDep
) -> StoreResponse:
    store = await stores.set_store_open(store_id, user.id, is_open=body.is_open)
    return StoreResponse.from_domain(stores.clock.now(), store)


@router.put("/stores/recommended", response_model=list[StoreResponse])
async def set_recommended_stores(
    body: SetRecommendedStoresRequest, _admin: RequireAdmin, stores: StoresDep
) -> list[StoreResponse]:
    """Backoffice: define las tiendas recomendadas y su orden (la primera va primero)."""
    updated = await stores.set_recommended_stores(body.store_ids)
    now = stores.clock.now()
    return [StoreResponse.from_domain(now, s) for s in updated]


@router.patch("/stores/{store_id}/approval", response_model=StoreResponse)
async def set_store_approval(
    store_id: UUID, body: SetStoreApprovalRequest, _admin: RequireAdmin, stores: StoresDep
) -> StoreResponse:
    """Backoffice: aprobar o rechazar una tienda. Solo administradores."""
    store = await stores.set_store_approval(store_id, is_approved=body.is_approved)
    return StoreResponse.from_domain(stores.clock.now(), store)


# --- Horario ------------------------------------------------------------------


@router.get("/stores/{store_id}/schedule", response_model=ScheduleResponse)
async def get_store_schedule(store_id: UUID, stores: StoresDep) -> ScheduleResponse:
    """Horario y estado actual (público: el cliente ve cuándo abre la tienda)."""
    store = await stores.get_store(store_id)
    return ScheduleResponse.from_domain(stores.clock.now(), store)


@router.put("/stores/{store_id}/schedule", response_model=ScheduleResponse)
async def set_store_schedule(
    store_id: UUID, body: UpdateScheduleRequest, user: CurrentUser, stores: StoresDep
) -> ScheduleResponse:
    """El dueño define su horario semanal (los 7 días)."""
    days = [DayHours(d.weekday, d.is_open, d.opens, d.closes, d.all_day) for d in body.days]
    store = await stores.set_store_hours(store_id, user.id, days)
    return ScheduleResponse.from_domain(stores.clock.now(), store)


@router.delete("/stores/{store_id}/schedule", response_model=ScheduleResponse)
async def clear_store_schedule(
    store_id: UUID, user: CurrentUser, stores: StoresDep
) -> ScheduleResponse:
    """Quita el horario semanal: la tienda vuelve a depender solo de su interruptor."""
    store = await stores.clear_store_hours(store_id, user.id)
    return ScheduleResponse.from_domain(stores.clock.now(), store)


@router.post("/stores/{store_id}/closed-dates", response_model=ScheduleResponse, status_code=201)
async def add_closed_date(
    store_id: UUID, body: ClosedDateRequest, user: CurrentUser, stores: StoresDep
) -> ScheduleResponse:
    """El dueño avisa un día en que no va a abrir (vacaciones, feriado, evento…)."""
    store = await stores.add_closed_date(store_id, user.id, body.day, body.reason)
    return ScheduleResponse.from_domain(stores.clock.now(), store)


@router.delete("/stores/{store_id}/closed-dates/{day}", response_model=ScheduleResponse)
async def remove_closed_date(
    store_id: UUID, day: date, user: CurrentUser, stores: StoresDep
) -> ScheduleResponse:
    store = await stores.remove_closed_date(store_id, user.id, day)
    return ScheduleResponse.from_domain(stores.clock.now(), store)


# --- Catálogo ----------------------------------------------------------------


@router.get("/stores/{store_id}/products", response_model=list[ProductResponse])
async def list_store_products(
    store_id: UUID, stores: StoresDep, only_available: bool = False
) -> list[ProductResponse]:
    products = await stores.list_store_products(store_id, only_available=only_available)
    return [ProductResponse.from_domain(p) for p in products]


@router.post(
    "/stores/{store_id}/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    store_id: UUID, body: CreateProductRequest, user: CurrentUser, stores: StoresDep
) -> ProductResponse:
    product = await stores.create_product(
        store_id,
        user.id,
        CreateProductCommand(
            name=body.name,
            description=body.description,
            price_cop=body.price_cop,
            image_url=body.image_url,
        ),
    )
    return ProductResponse.from_domain(product)


@router.patch("/stores/{store_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(
    store_id: UUID,
    product_id: UUID,
    body: UpdateProductRequest,
    user: CurrentUser,
    stores: StoresDep,
) -> ProductResponse:
    product = await stores.update_product(
        store_id,
        product_id,
        user.id,
        name=body.name,
        description=body.description,
        price_cop=body.price_cop,
        image_url=body.image_url,
    )
    return ProductResponse.from_domain(product)


@router.patch(
    "/stores/{store_id}/products/{product_id}/availability", response_model=ProductResponse
)
async def set_product_availability(
    store_id: UUID,
    product_id: UUID,
    body: SetProductAvailabilityRequest,
    user: CurrentUser,
    stores: StoresDep,
) -> ProductResponse:
    product = await stores.set_product_availability(
        store_id, product_id, user.id, is_available=body.is_available
    )
    return ProductResponse.from_domain(product)


@router.delete("/stores/{store_id}/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    store_id: UUID, product_id: UUID, user: CurrentUser, stores: StoresDep
) -> Response:
    await stores.delete_product(store_id, product_id, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Búsqueda ----------------------------------------------------------------


@router.get("/products/search", response_model=list[SearchResultResponse])
async def search_products(
    stores: StoresDep,
    q: str = "",
    category: StoreCategory | None = None,
    max_price_cop: int | None = None,
    sort: str = "relevance",
) -> list[SearchResultResponse]:
    results = await stores.search_products(
        SearchProductsQuery(text=q, category=category, max_price_cop=max_price_cop, sort=sort)
    )
    return [SearchResultResponse.from_domain(stores.clock.now(), r) for r in results]
