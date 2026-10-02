from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.modules.suppliers.application.use_cases import (
    Subscription,
    SupplierFilter,
    SupplierRow,
)
from neirapp.modules.suppliers.domain.entities import (
    MAX_DESCRIPTION,
    Supplier,
    SupplierCategory,
    SupplierData,
)
from neirapp.modules.suppliers.domain.payments import (
    MAX_REFERENCE,
    SUBSCRIPTION_DAYS,
    SUBSCRIPTION_FEE_COP,
    PaymentStatus,
    SupplierPayment,
)
from neirapp.modules.suppliers.presentation.dependencies import SuppliersDep

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

RequireSupplier = Annotated[User, Depends(require_roles(Role.SUPPLIER, Role.ADMIN))]
RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]


class SupplierRequest(BaseModel):
    company_name: str = Field(max_length=200)
    category: SupplierCategory
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    phone: str = Field(max_length=30)
    tagline: str = Field(default="", max_length=200)
    whatsapp: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=320)
    address: str = Field(default="", max_length=240)
    website: str = Field(default="", max_length=300)
    facebook: str = Field(default="", max_length=300)
    instagram: str = Field(default="", max_length=300)
    logo_url: str = Field(default="", max_length=300)
    cover_url: str = Field(default="", max_length=300)
    catalog_url: str = Field(default="", max_length=300)
    is_listed: bool = True

    def to_data(self) -> SupplierData:
        return SupplierData(**self.model_dump())


class SupplierResponse(BaseModel):
    user_id: UUID
    company_name: str
    tagline: str
    category: SupplierCategory
    description: str
    phone: str
    whatsapp: str
    email: str
    address: str
    website: str
    facebook: str
    instagram: str
    logo_url: str
    cover_url: str
    catalog_url: str
    is_listed: bool
    paid_until: datetime | None
    updated_at: datetime

    @classmethod
    def from_domain(cls, s: Supplier) -> "SupplierResponse":
        return cls(
            user_id=s.user_id,
            company_name=s.company_name,
            tagline=s.tagline,
            category=s.category,
            description=s.description,
            phone=s.phone,
            whatsapp=s.whatsapp,
            email=s.email,
            address=s.address,
            website=s.website,
            facebook=s.facebook,
            instagram=s.instagram,
            logo_url=s.logo_url,
            cover_url=s.cover_url,
            catalog_url=s.catalog_url,
            is_listed=s.is_listed,
            paid_until=s.paid_until,
            updated_at=s.updated_at,
        )


class PaymentResponse(BaseModel):
    id: UUID
    status: PaymentStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    starts_at: datetime | None
    expires_at: datetime | None

    @classmethod
    def from_domain(cls, p: SupplierPayment) -> "PaymentResponse":
        return cls(
            id=p.id,
            status=p.status,
            amount_cop=p.amount_cop,
            reference=p.reference,
            note=p.note,
            requested_at=p.requested_at,
            starts_at=p.starts_at,
            expires_at=p.expires_at,
        )


def _pay(p: SupplierPayment | None) -> PaymentResponse | None:
    return PaymentResponse.from_domain(p) if p else None


class SubscriptionResponse(BaseModel):
    fee_cop: int = SUBSCRIPTION_FEE_COP
    days: int = SUBSCRIPTION_DAYS
    paid_until: datetime | None
    pending: PaymentResponse | None
    rejected: PaymentResponse | None
    history: list[PaymentResponse]

    @classmethod
    def from_domain(cls, sub: Subscription) -> "SubscriptionResponse":
        return cls(
            paid_until=sub.paid_until,
            pending=_pay(sub.pending),
            rejected=_pay(sub.rejected),
            history=[PaymentResponse.from_domain(p) for p in sub.history],
        )


class SupplierRowResponse(BaseModel):
    supplier: SupplierResponse
    subscription: SubscriptionResponse
    has_access: bool

    @classmethod
    def from_row(cls, row: SupplierRow) -> "SupplierRowResponse":
        return cls(
            supplier=SupplierResponse.from_domain(row.supplier),
            subscription=SubscriptionResponse.from_domain(row.subscription),
            has_access=row.has_access,
        )


class PaymentBody(BaseModel):
    reference: str = Field(default="", max_length=MAX_REFERENCE * 2)


class NoteBody(BaseModel):
    note: str = Field(default="", max_length=600)


@router.get("/me/subscription", response_model=SubscriptionResponse)
async def get_my_subscription(user: RequireSupplier, app: SuppliersDep) -> SubscriptionResponse:
    """Hasta cuándo aparece, el pago en revisión y el historial."""
    return SubscriptionResponse.from_domain(await app.get_my_subscription(user.id))


@router.post("/me/subscription/payments", response_model=SubscriptionResponse, status_code=201)
async def request_subscription_payment(
    body: PaymentBody, user: RequireSupplier, app: SuppliersDep
) -> SubscriptionResponse:
    """Reporta el pago de un mes ($ 24.900); el administrador lo confirma."""
    sub = await app.request_subscription_payment(user.id, body.reference)
    return SubscriptionResponse.from_domain(sub)


@router.put("/me/subscription/payments/{payment_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription_payment(
    payment_id: UUID, user: RequireSupplier, app: SuppliersDep
) -> SubscriptionResponse:
    sub = await app.cancel_subscription_payment(user.id, payment_id)
    return SubscriptionResponse.from_domain(sub)


# Antes que "/{user_id}" para que "admin" no se tome como un id.
@router.get("/admin/subscriptions", response_model=list[SupplierRowResponse])
async def list_supplier_subscriptions(
    _admin: RequireAdmin, app: SuppliersDep
) -> list[SupplierRowResponse]:
    """Todas las empresas con su suscripción; primero las que tienen un pago por confirmar."""
    return [SupplierRowResponse.from_row(r) for r in await app.list_supplier_subscriptions()]


@router.put("/admin/payments/{payment_id}/approve", response_model=PaymentResponse)
async def approve_subscription_payment(
    payment_id: UUID, _admin: RequireAdmin, app: SuppliersDep
) -> PaymentResponse:
    return PaymentResponse.from_domain(await app.approve_subscription_payment(payment_id))


@router.put("/admin/payments/{payment_id}/reject", response_model=PaymentResponse)
async def reject_subscription_payment(
    payment_id: UUID, body: NoteBody, _admin: RequireAdmin, app: SuppliersDep
) -> PaymentResponse:
    payment = await app.reject_subscription_payment(payment_id, body.note)
    return PaymentResponse.from_domain(payment)


@router.post("/admin/{user_id}/grant-month", response_model=PaymentResponse)
async def grant_subscription_month(
    user_id: UUID, _admin: RequireAdmin, app: SuppliersDep
) -> PaymentResponse:
    """Activa un mes sin pago reportado (cortesía o pago recibido por otro medio)."""
    return PaymentResponse.from_domain(await app.grant_subscription_month(user_id))


@router.put("/admin/{user_id}/end", response_model=SupplierResponse)
async def end_subscription(
    user_id: UUID, _admin: RequireAdmin, app: SuppliersDep
) -> SupplierResponse:
    """Quita la suscripción desde hoy: la empresa deja de aparecer."""
    return SupplierResponse.from_domain(await app.end_subscription(user_id))


@router.get("/me", response_model=SupplierResponse)
async def get_my_supplier(user: RequireSupplier, app: SuppliersDep) -> SupplierResponse:
    """El perfil de la empresa que inició sesión (404 si todavía no lo ha creado)."""
    return SupplierResponse.from_domain(await app.get_my_supplier(user.id))


@router.put("/me", response_model=SupplierResponse)
async def save_my_supplier(
    body: SupplierRequest, user: RequireSupplier, app: SuppliersDep
) -> SupplierResponse:
    """Crea o actualiza el perfil. Se publica mientras la cuenta tenga acceso de proveedor."""
    return SupplierResponse.from_domain(await app.save_my_supplier(user.id, body.to_data()))


@router.get("", response_model=list[SupplierResponse])
async def list_suppliers(
    app: SuppliersDep, category: Annotated[SupplierCategory | None, Query()] = None
) -> list[SupplierResponse]:
    """Directorio público de proveedores, los actualizados más recientemente primero."""
    suppliers = await app.list_suppliers(SupplierFilter(category=category))
    return [SupplierResponse.from_domain(s) for s in suppliers]


@router.get("/{user_id}", response_model=SupplierResponse)
async def get_supplier(user_id: UUID, app: SuppliersDep) -> SupplierResponse:
    return SupplierResponse.from_domain(await app.get_supplier(user_id))
