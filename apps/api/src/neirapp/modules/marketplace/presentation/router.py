from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.marketplace.application.use_cases import (
    MyListing,
    PendingPayment,
    ReportedListing,
)
from neirapp.modules.marketplace.domain.listings import (
    MAX_DESCRIPTION,
    MAX_PHOTOS,
    MAX_TITLE,
    Listing,
    ListingCategory,
    ListingData,
    ListingKind,
    RentPeriod,
)
from neirapp.modules.marketplace.domain.payments import (
    LISTING_DAYS,
    LISTING_FEE_COP,
    MAX_REFERENCE,
    ListingPayment,
    PaymentStatus,
)
from neirapp.modules.marketplace.domain.reports import (
    MAX_DETAILS,
    Report,
    ReportReason,
)
from neirapp.modules.marketplace.presentation.dependencies import MarketplaceDep

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]


class ListingRequest(BaseModel):
    title: str = Field(max_length=MAX_TITLE * 2)
    kind: ListingKind
    category: ListingCategory
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    quantity: int
    photos: list[str] = Field(max_length=MAX_PHOTOS * 2)
    whatsapp: str = Field(max_length=30)
    price_cop: int | None = None
    negotiable: bool = False
    rent_period: RentPeriod = RentPeriod.MONTH

    def to_data(self) -> ListingData:
        return ListingData(
            title=self.title,
            kind=self.kind,
            category=self.category,
            description=self.description,
            quantity=self.quantity,
            photos=self.photos,
            whatsapp=self.whatsapp,
            price_cop=self.price_cop,
            negotiable=self.negotiable,
            rent_period=self.rent_period,
        )


class ListingResponse(BaseModel):
    """Lo que ve cualquiera. El WhatsApp del vendedor es para el botón "Chat con vendedor"."""

    id: UUID
    seller_id: UUID
    seller_name: str
    title: str
    kind: ListingKind
    category: ListingCategory
    description: str
    quantity: int
    whatsapp: str
    price_cop: int | None
    negotiable: bool
    rent_period: RentPeriod
    photos: list[str]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, item: Listing) -> "ListingResponse":
        return cls(
            id=item.id,
            seller_id=item.seller_id,
            seller_name=item.seller_name.split(" ")[0] if item.seller_name else "",
            title=item.title,
            kind=item.kind,
            category=item.category,
            description=item.description,
            quantity=item.quantity,
            whatsapp=item.whatsapp,
            price_cop=item.price_cop,
            negotiable=item.negotiable,
            rent_period=item.rent_period,
            photos=item.photos,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )


class PaymentResponse(BaseModel):
    id: UUID
    listing_id: UUID
    status: PaymentStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    starts_at: datetime | None
    expires_at: datetime | None

    @classmethod
    def from_domain(cls, p: ListingPayment) -> "PaymentResponse":
        return cls(
            id=p.id,
            listing_id=p.listing_id,
            status=p.status,
            amount_cop=p.amount_cop,
            reference=p.reference,
            note=p.note,
            requested_at=p.requested_at,
            starts_at=p.starts_at,
            expires_at=p.expires_at,
        )


class MyListingResponse(ListingResponse):
    is_active: bool
    removed: bool
    removed_note: str
    paid_until: datetime | None
    pending_payment: PaymentResponse | None
    rejected_payment: PaymentResponse | None

    @classmethod
    def from_mine(cls, mine: MyListing) -> "MyListingResponse":
        item = mine.listing
        base = ListingResponse.from_domain(item).model_dump()
        base["seller_name"] = item.seller_name
        return cls(
            **base,
            is_active=item.is_active,
            removed=item.removed,
            removed_note=item.removed_note,
            paid_until=item.paid_until,
            pending_payment=PaymentResponse.from_domain(mine.pending) if mine.pending else None,
            rejected_payment=PaymentResponse.from_domain(mine.rejected) if mine.rejected else None,
        )


class FeeResponse(BaseModel):
    amount_cop: int = LISTING_FEE_COP
    days: int = LISTING_DAYS


class ActiveBody(BaseModel):
    is_active: bool


class PaymentBody(BaseModel):
    reference: str = Field(default="", max_length=MAX_REFERENCE * 2)


class NoteBody(BaseModel):
    note: str = Field(default="", max_length=600)


class ReportBody(BaseModel):
    reason: ReportReason
    details: str = Field(default="", max_length=MAX_DETAILS * 2)


class ReportResponse(BaseModel):
    id: UUID
    reason: ReportReason
    details: str
    created_at: datetime

    @classmethod
    def from_domain(cls, r: Report) -> "ReportResponse":
        return cls(id=r.id, reason=r.reason, details=r.details, created_at=r.created_at)


class ReportedListingResponse(BaseModel):
    listing: MyListingResponse
    reports: list[ReportResponse]

    @classmethod
    def from_row(cls, row: ReportedListing) -> "ReportedListingResponse":
        return cls(
            listing=MyListingResponse.from_mine(MyListing(row.listing, None, None)),
            reports=[ReportResponse.from_domain(r) for r in row.reports],
        )


class PendingPaymentResponse(PaymentResponse):
    listing_title: str
    seller_name: str
    seller_whatsapp: str

    @classmethod
    def from_row(cls, row: PendingPayment) -> "PendingPaymentResponse":
        return cls(
            **PaymentResponse.from_domain(row.payment).model_dump(),
            listing_title=row.listing.title,
            seller_name=row.listing.seller_name,
            seller_whatsapp=row.listing.whatsapp,
        )


# ---------- Vendedor (cualquier persona con cuenta) ----------


@router.get("/fee", response_model=FeeResponse)
async def get_fee() -> FeeResponse:
    """Lo que cuesta publicar: por publicación y por mes."""
    return FeeResponse()


@router.get("/me/listings", response_model=list[MyListingResponse])
async def list_my_listings(user: CurrentUser, app: MarketplaceDep) -> list[MyListingResponse]:
    return [MyListingResponse.from_mine(m) for m in await app.list_my_listings(user.id)]


@router.post("/me/listings", response_model=MyListingResponse, status_code=201)
async def create_listing(
    body: ListingRequest, user: CurrentUser, app: MarketplaceDep
) -> MyListingResponse:
    """La crea sin publicar: se ve cuando se confirme el pago del primer mes."""
    return MyListingResponse.from_mine(await app.create_listing(user.id, body.to_data()))


@router.put("/me/listings/{listing_id}", response_model=MyListingResponse)
async def update_listing(
    listing_id: UUID, body: ListingRequest, user: CurrentUser, app: MarketplaceDep
) -> MyListingResponse:
    mine = await app.update_listing(user.id, listing_id, body.to_data())
    return MyListingResponse.from_mine(mine)


@router.put("/me/listings/{listing_id}/active", response_model=MyListingResponse)
async def set_listing_active(
    listing_id: UUID, body: ActiveBody, user: CurrentUser, app: MarketplaceDep
) -> MyListingResponse:
    """Pausa la publicación (vendido, sin unidades) o la vuelve a mostrar."""
    mine = await app.set_listing_active(user.id, listing_id, body.is_active)
    return MyListingResponse.from_mine(mine)


@router.delete("/me/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(listing_id: UUID, user: CurrentUser, app: MarketplaceDep) -> Response:
    await app.delete_listing(user.id, listing_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/me/listings/{listing_id}/payments", response_model=MyListingResponse, status_code=201
)
async def request_payment(
    listing_id: UUID, body: PaymentBody, user: CurrentUser, app: MarketplaceDep
) -> MyListingResponse:
    """Reporta el pago de un mes; el administrador lo confirma."""
    mine = await app.request_payment(user.id, listing_id, body.reference)
    return MyListingResponse.from_mine(mine)


@router.put("/me/payments/{payment_id}/cancel", response_model=MyListingResponse)
async def cancel_payment(
    payment_id: UUID, user: CurrentUser, app: MarketplaceDep
) -> MyListingResponse:
    return MyListingResponse.from_mine(await app.cancel_payment(user.id, payment_id))


# ---------- Administrador ----------


@router.get("/admin/payments", response_model=list[PendingPaymentResponse])
async def list_pending_payments(
    _admin: RequireAdmin, app: MarketplaceDep
) -> list[PendingPaymentResponse]:
    return [PendingPaymentResponse.from_row(r) for r in await app.list_pending_payments()]


@router.put("/admin/payments/{payment_id}/approve", response_model=PaymentResponse)
async def approve_payment(
    payment_id: UUID, _admin: RequireAdmin, app: MarketplaceDep
) -> PaymentResponse:
    return PaymentResponse.from_domain(await app.approve_payment(payment_id))


@router.put("/admin/payments/{payment_id}/reject", response_model=PaymentResponse)
async def reject_payment(
    payment_id: UUID, body: NoteBody, _admin: RequireAdmin, app: MarketplaceDep
) -> PaymentResponse:
    return PaymentResponse.from_domain(await app.reject_payment(payment_id, body.note))


@router.get("/admin/reports", response_model=list[ReportedListingResponse])
async def list_reported_listings(
    _admin: RequireAdmin, app: MarketplaceDep
) -> list[ReportedListingResponse]:
    return [ReportedListingResponse.from_row(r) for r in await app.list_reported_listings()]


@router.put("/admin/listings/{listing_id}/dismiss-reports", status_code=204)
async def dismiss_reports(listing_id: UUID, _admin: RequireAdmin, app: MarketplaceDep) -> Response:
    """La publicación está bien: se cierran sus reportes."""
    await app.dismiss_reports(listing_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/admin/listings/{listing_id}/remove", status_code=204)
async def remove_listing(
    listing_id: UUID, body: NoteBody, _admin: RequireAdmin, app: MarketplaceDep
) -> Response:
    """La retira de MarquetNeira y le cuenta el motivo al vendedor."""
    await app.remove_listing(listing_id, body.note)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/admin/listings/{listing_id}/restore", status_code=204)
async def restore_listing(listing_id: UUID, _admin: RequireAdmin, app: MarketplaceDep) -> Response:
    await app.restore_listing(listing_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Público ----------


@router.get("/listings", response_model=list[ListingResponse])
async def list_public_listings(app: MarketplaceDep) -> list[ListingResponse]:
    """Inmuebles publicados (activos y con el mes pagado), los más recientes primero."""
    return [ListingResponse.from_domain(item) for item in await app.list_public_listings()]


@router.get("/listings/{listing_id}", response_model=ListingResponse)
async def get_public_listing(listing_id: UUID, app: MarketplaceDep) -> ListingResponse:
    return ListingResponse.from_domain(await app.get_public_listing(listing_id))


@router.post("/listings/{listing_id}/reports", status_code=201)
async def report_listing(
    listing_id: UUID, body: ReportBody, user: CurrentUser, app: MarketplaceDep
) -> dict[str, str]:
    """Reporta una publicación inadecuada; los administradores reciben un aviso."""
    await app.report_listing(user.id, listing_id, body.reason, body.details)
    return {"message": "Gracias por reportar. Nuestro equipo revisará esta publicación en breve."}
