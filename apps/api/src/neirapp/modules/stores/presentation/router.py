from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.stores.application.products import (
    CreateProductCommand,
    SearchProductsQuery,
)
from neirapp.modules.stores.application.stores import CreateStoreCommand
from neirapp.modules.stores.domain.entities import StoreCategory
from neirapp.modules.stores.presentation.dependencies import StoresDep
from neirapp.modules.stores.presentation.schemas import (
    CreateProductRequest,
    CreateStoreRequest,
    ProductResponse,
    SearchResultResponse,
    SetProductAvailabilityRequest,
    SetStoreApprovalRequest,
    SetStoreOpenRequest,
    StoreResponse,
    UpdateProductRequest,
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
    return StoreResponse.from_domain(store)


@router.get("/stores", response_model=list[StoreResponse])
async def list_stores(
    stores: StoresDep, category: StoreCategory | None = None
) -> list[StoreResponse]:
    result = await stores.list_stores(category=category)
    return [StoreResponse.from_domain(s) for s in result]


@router.get("/stores/me", response_model=StoreResponse | None)
async def my_store(user: CurrentUser, stores: StoresDep) -> StoreResponse | None:
    store = await stores.get_my_store(user.id)
    return StoreResponse.from_domain(store) if store else None


@router.get("/stores/pending", response_model=list[StoreResponse])
async def list_pending_stores(_admin: RequireAdmin, stores: StoresDep) -> list[StoreResponse]:
    """Backoffice: tiendas que un admin todavía no ha aprobado ni rechazado."""
    result = await stores.list_stores(is_approved=False)
    return [StoreResponse.from_domain(s) for s in result]


@router.get("/stores/{store_id}", response_model=StoreResponse)
async def get_store(store_id: UUID, stores: StoresDep) -> StoreResponse:
    return StoreResponse.from_domain(await stores.get_store(store_id))


@router.patch("/stores/{store_id}", response_model=StoreResponse)
async def update_store(
    store_id: UUID, body: UpdateStoreRequest, user: CurrentUser, stores: StoresDep
) -> StoreResponse:
    store = await stores.update_store(
        store_id, user.id, name=body.name, category=body.category, description=body.description
    )
    return StoreResponse.from_domain(store)


@router.patch("/stores/{store_id}/open", response_model=StoreResponse)
async def set_store_open(
    store_id: UUID, body: SetStoreOpenRequest, user: CurrentUser, stores: StoresDep
) -> StoreResponse:
    store = await stores.set_store_open(store_id, user.id, is_open=body.is_open)
    return StoreResponse.from_domain(store)


@router.patch("/stores/{store_id}/approval", response_model=StoreResponse)
async def set_store_approval(
    store_id: UUID, body: SetStoreApprovalRequest, _admin: RequireAdmin, stores: StoresDep
) -> StoreResponse:
    """Backoffice: aprobar o rechazar una tienda. Solo administradores."""
    store = await stores.set_store_approval(store_id, is_approved=body.is_approved)
    return StoreResponse.from_domain(store)


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
    return [SearchResultResponse.from_domain(r) for r in results]
