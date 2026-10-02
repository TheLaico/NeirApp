from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from neirapp.modules.suppliers.application.ports import (
    AccessPort,
    NotifierPort,
    PaymentRepository,
    SupplierRepository,
)
from neirapp.modules.suppliers.domain.entities import Supplier, SupplierCategory, SupplierData
from neirapp.modules.suppliers.domain.errors import (
    PaymentNotFound,
    PaymentPending,
    ProfileRequired,
    SupplierNotFound,
)
from neirapp.modules.suppliers.domain.payments import PaymentStatus, SupplierPayment
from neirapp.shared.application.ports import Clock

# A dónde lleva el aviso en el frontend.
MY_SUBSCRIPTION = "/proveedor?seccion=subscription"
COLOMBIA = timezone(timedelta(hours=-5))  # Sin horario de verano
_MONTHS = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)  # fmt: skip


def _day(moment: datetime) -> str:
    local = moment.astimezone(COLOMBIA)
    return f"{local.day} de {_MONTHS[local.month - 1]}"


class GetMySupplier:
    def __init__(self, repo: SupplierRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> Supplier:
        supplier = await self._repo.get(user_id)
        if supplier is None:
            raise SupplierNotFound()
        return supplier


class SaveMySupplier:
    """Crea el perfil de la empresa la primera vez y lo reemplaza las siguientes."""

    def __init__(self, repo: SupplierRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, data: SupplierData) -> Supplier:
        now = self._clock.now()
        supplier = await self._repo.get(user_id)
        if supplier is None:
            supplier = Supplier.create(user_id, data, now)
        else:
            supplier.update(data, now)
        await self._repo.save(supplier)
        return supplier


@dataclass(frozen=True)
class SupplierFilter:
    category: SupplierCategory | None = None


class ListSuppliers:
    """Lo que ven los clientes: empresas autorizadas, con la suscripción al día y visibles."""

    def __init__(self, repo: SupplierRepository, access: AccessPort, clock: Clock) -> None:
        self._repo = repo
        self._access = access
        self._clock = clock

    async def __call__(self, flt: SupplierFilter) -> list[Supplier]:
        allowed = await self._access.supplier_ids()
        now = self._clock.now()
        return [
            s
            for s in await self._repo.list_all()
            if s.user_id in allowed
            and s.is_public(now)
            and (flt.category is None or s.category is flt.category)
        ]


class GetSupplier:
    def __init__(self, repo: SupplierRepository, access: AccessPort, clock: Clock) -> None:
        self._repo = repo
        self._access = access
        self._clock = clock

    async def __call__(self, user_id: UUID) -> Supplier:
        supplier = await self._repo.get(user_id)
        if (
            supplier is None
            or not supplier.is_public(self._clock.now())
            or user_id not in await self._access.supplier_ids()
        ):
            raise SupplierNotFound()
        return supplier


@dataclass(frozen=True)
class Subscription:
    """Lo que ve la empresa en "Suscripción": hasta cuándo tiene pagado, el pago que espera
    confirmación, el último rechazado (si es lo último que pasó) y su historial."""

    paid_until: datetime | None
    pending: SupplierPayment | None
    rejected: SupplierPayment | None
    history: list[SupplierPayment]


def _subscription(supplier: Supplier | None, payments: list[SupplierPayment]) -> Subscription:
    pending = next((p for p in payments if p.status is PaymentStatus.PENDING), None)
    last = payments[0] if payments else None
    rejected = last if last and last.status is PaymentStatus.REJECTED else None
    approved = [p for p in payments if p.status is PaymentStatus.APPROVED]
    return Subscription(supplier.paid_until if supplier else None, pending, rejected, approved)


class GetMySubscription:
    def __init__(self, repo: SupplierRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self, user_id: UUID) -> Subscription:
        return _subscription(await self._repo.get(user_id), await self._payments.list_for(user_id))


class RequestSubscriptionPayment:
    """La empresa pagó (por fuera) un mes de suscripción y lo reporta para que lo confirmen."""

    def __init__(self, repo: SupplierRepository, payments: PaymentRepository, clock: Clock) -> None:
        self._repo = repo
        self._payments = payments
        self._clock = clock

    async def __call__(self, user_id: UUID, reference: str) -> Subscription:
        supplier = await self._repo.get(user_id)
        if supplier is None:
            raise ProfileRequired()
        mine = await self._payments.list_for(user_id)
        if any(p.status is PaymentStatus.PENDING for p in mine):
            raise PaymentPending()
        await self._payments.save(SupplierPayment.request(user_id, reference, self._clock.now()))
        return _subscription(supplier, await self._payments.list_for(user_id))


class CancelSubscriptionPayment:
    def __init__(self, repo: SupplierRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self, user_id: UUID, payment_id: UUID) -> Subscription:
        payment = await self._payments.get(payment_id)
        if payment is None or payment.supplier_id != user_id:
            raise PaymentNotFound()
        payment.cancel()
        await self._payments.save(payment)
        return _subscription(await self._repo.get(user_id), await self._payments.list_for(user_id))


@dataclass(frozen=True)
class SupplierRow:
    """Para el administrador: una empresa con su suscripción."""

    supplier: Supplier
    subscription: Subscription
    has_access: bool  # Sin el rol de proveedor no aparece aunque esté al día


class ListSupplierSubscriptions:
    """Todas las empresas con perfil; primero las que tienen un pago por confirmar."""

    def __init__(
        self, repo: SupplierRepository, payments: PaymentRepository, access: AccessPort
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._access = access

    async def __call__(self) -> list[SupplierRow]:
        allowed = await self._access.supplier_ids()
        rows = [
            SupplierRow(
                s,
                _subscription(s, await self._payments.list_for(s.user_id)),
                s.user_id in allowed,
            )
            for s in await self._repo.list_all()
        ]
        return sorted(
            rows,
            key=lambda r: (
                r.subscription.pending is None,
                r.subscription.pending.requested_at.timestamp() if r.subscription.pending else 0,
                r.supplier.company_name.lower(),
            ),
        )


async def _activate(
    repo: SupplierRepository,
    payments: PaymentRepository,
    notifier: NotifierPort,
    supplier: Supplier,
    payment: SupplierPayment,
    now: datetime,
) -> SupplierPayment:
    # Si todavía le quedaba tiempo pagado, el mes nuevo empieza cuando termine: no pierde días.
    starts = supplier.paid_until if supplier.is_paid(now) and supplier.paid_until else now
    payment.approve(starts, now)
    supplier.paid_until = payment.expires_at
    await payments.save(payment)
    await repo.save(supplier)
    await notifier.notify(
        supplier.user_id,
        "supplier_activated",
        "Tu suscripción de Proveedores está activa",
        f"{supplier.company_name} aparece en Proveedores hasta el "
        f"{_day(payment.expires_at or now)}.",
        MY_SUBSCRIPTION,
    )
    return payment


class ApproveSubscriptionPayment:
    """El administrador vio el pago: la empresa aparece 30 días más."""

    def __init__(
        self,
        repo: SupplierRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID) -> SupplierPayment:
        payment = await self._payments.get(payment_id)
        supplier = await self._repo.get(payment.supplier_id) if payment else None
        if payment is None or supplier is None:
            raise PaymentNotFound()
        return await _activate(
            self._repo, self._payments, self._notifier, supplier, payment, self._clock.now()
        )


class GrantSubscriptionMonth:
    """El administrador activa un mes directamente (cortesía o pago recibido por otro medio)."""

    def __init__(
        self,
        repo: SupplierRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, user_id: UUID) -> SupplierPayment:
        supplier = await self._repo.get(user_id)
        if supplier is None:
            raise SupplierNotFound()
        now = self._clock.now()
        payment = SupplierPayment.request(user_id, "Activado por el administrador", now)
        return await _activate(self._repo, self._payments, self._notifier, supplier, payment, now)


class RejectSubscriptionPayment:
    def __init__(
        self,
        repo: SupplierRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID, note: str) -> SupplierPayment:
        payment = await self._payments.get(payment_id)
        if payment is None:
            raise PaymentNotFound()
        payment.reject(note, self._clock.now())
        await self._payments.save(payment)
        await self._notifier.notify(
            payment.supplier_id,
            "supplier_payment_rejected",
            "No pudimos confirmar tu pago",
            f"{payment.note.rstrip('.')}. Revisa el pago y vuelve a enviarlo.",
            MY_SUBSCRIPTION,
        )
        return payment


class EndSubscription:
    """El administrador la quita desde hoy: la empresa deja de aparecer."""

    def __init__(self, repo: SupplierRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID) -> Supplier:
        supplier = await self._repo.get(user_id)
        if supplier is None:
            raise SupplierNotFound()
        now = self._clock.now()
        if supplier.is_paid(now):
            supplier.paid_until = now
            await self._repo.save(supplier)
        return supplier
