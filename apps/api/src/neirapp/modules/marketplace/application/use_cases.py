from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from neirapp.modules.marketplace.application.ports import (
    AccountsPort,
    ListingRepository,
    NotifierPort,
    PaymentRepository,
    ReportRepository,
)
from neirapp.modules.marketplace.domain.errors import (
    AlreadyReported,
    CannotReportOwnListing,
    ListingNotFound,
    ListingRemoved,
    MissingNote,
    PaymentNotFound,
    PaymentPending,
    TooManyListings,
)
from neirapp.modules.marketplace.domain.listings import (
    MAX_LISTINGS_PER_SELLER,
    Listing,
    ListingData,
)
from neirapp.modules.marketplace.domain.payments import ListingPayment, PaymentStatus
from neirapp.modules.marketplace.domain.reports import (
    Report,
    ReportReason,
    ReportStatus,
)
from neirapp.shared.application.ports import Clock

# A dónde lleva cada aviso en el frontend.
MY_LISTINGS = "/marquetneira/mis-publicaciones"
ADMIN_MARKETPLACE = "/admin/marquetneira"


COLOMBIA = timezone(timedelta(hours=-5))  # Sin horario de verano
_MONTHS = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)  # fmt: skip


def _day(moment: datetime) -> str:
    local = moment.astimezone(COLOMBIA)
    return f"{local.day} de {_MONTHS[local.month - 1]}"


async def _own(repo: ListingRepository, seller_id: UUID, listing_id: UUID) -> Listing:
    # Una publicación de otra persona se trata como inexistente.
    listing = await repo.get(listing_id)
    if listing is None or listing.seller_id != seller_id:
        raise ListingNotFound()
    return listing


@dataclass(frozen=True)
class MyListing:
    """Para "Mis publicaciones": la publicación, el pago que espera confirmación y el último
    rechazado (si es lo último que pasó)."""

    listing: Listing
    pending: ListingPayment | None
    rejected: ListingPayment | None


def _mine(listing: Listing, payments: list[ListingPayment]) -> MyListing:
    own = [p for p in payments if p.listing_id == listing.id]  # más recientes primero
    pending = next((p for p in own if p.status is PaymentStatus.PENDING), None)
    last = own[0] if own else None
    rejected = last if last and last.status is PaymentStatus.REJECTED else None
    return MyListing(listing, pending, rejected)


class ListMyListings:
    def __init__(self, repo: ListingRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self, seller_id: UUID) -> list[MyListing]:
        payments = await self._payments.list_for_seller(seller_id)
        return [_mine(item, payments) for item in await self._repo.list_for_seller(seller_id)]


class CreateListing:
    """Cualquier persona con cuenta publica un inmueble. Queda guardada pero no se ve hasta pagar
    el primer mes."""

    def __init__(self, repo: ListingRepository, accounts: AccountsPort, clock: Clock) -> None:
        self._repo = repo
        self._accounts = accounts
        self._clock = clock

    async def __call__(self, seller_id: UUID, data: ListingData) -> MyListing:
        if len(await self._repo.list_for_seller(seller_id)) >= MAX_LISTINGS_PER_SELLER:
            raise TooManyListings()
        account = await self._accounts.account(seller_id)
        listing = Listing.create(
            seller_id, account.name if account else "", data, self._clock.now()
        )
        await self._repo.save(listing)
        return MyListing(listing, None, None)


class UpdateListing:
    def __init__(
        self,
        repo: ListingRepository,
        payments: PaymentRepository,
        accounts: AccountsPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._accounts = accounts
        self._clock = clock

    async def __call__(self, seller_id: UUID, listing_id: UUID, data: ListingData) -> MyListing:
        listing = await _own(self._repo, seller_id, listing_id)
        listing.update(data, self._clock.now())
        account = await self._accounts.account(seller_id)
        if account:
            listing.seller_name = account.name
        await self._repo.save(listing)
        return _mine(listing, await self._payments.list_for_seller(seller_id))


class SetListingActive:
    """El vendedor la pausa (lo vendió, no le quedan unidades) o la vuelve a mostrar."""

    def __init__(self, repo: ListingRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self, seller_id: UUID, listing_id: UUID, is_active: bool) -> MyListing:
        listing = await _own(self._repo, seller_id, listing_id)
        if listing.removed and is_active:
            raise ListingRemoved()
        listing.is_active = is_active
        await self._repo.save(listing)
        return _mine(listing, await self._payments.list_for_seller(seller_id))


class DeleteListing:
    def __init__(self, repo: ListingRepository) -> None:
        self._repo = repo

    async def __call__(self, seller_id: UUID, listing_id: UUID) -> None:
        await _own(self._repo, seller_id, listing_id)
        await self._repo.delete(listing_id)


class ListPublicListings:
    """Lo que ven los clientes: activas, pagadas y no retiradas; las más recientes primero."""

    def __init__(self, repo: ListingRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self) -> list[Listing]:
        now = self._clock.now()
        return [item for item in await self._repo.list_all() if item.is_public(now)]


class GetPublicListing:
    def __init__(self, repo: ListingRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, listing_id: UUID, viewer_id: UUID | None = None) -> Listing:
        listing = await self._repo.get(listing_id)
        # Su dueño la ve siempre (para revisar cómo queda); los demás, solo si está publicada.
        if listing is None or (
            listing.seller_id != viewer_id and not listing.is_public(self._clock.now())
        ):
            raise ListingNotFound()
        return listing


class RequestPayment:
    """El vendedor pagó (por fuera) un mes de publicación y lo reporta para que lo confirmen."""

    def __init__(self, repo: ListingRepository, payments: PaymentRepository, clock: Clock) -> None:
        self._repo = repo
        self._payments = payments
        self._clock = clock

    async def __call__(self, seller_id: UUID, listing_id: UUID, reference: str) -> MyListing:
        listing = await _own(self._repo, seller_id, listing_id)
        if listing.removed:
            raise ListingRemoved()
        mine = await self._payments.list_for_seller(seller_id)
        if any(p.listing_id == listing_id and p.status is PaymentStatus.PENDING for p in mine):
            raise PaymentPending()
        payment = ListingPayment.request(listing_id, seller_id, reference, self._clock.now())
        await self._payments.save(payment)
        return MyListing(listing, payment, None)


class CancelPayment:
    def __init__(self, repo: ListingRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self, seller_id: UUID, payment_id: UUID) -> MyListing:
        payment = await self._payments.get(payment_id)
        if payment is None or payment.seller_id != seller_id:
            raise PaymentNotFound()
        payment.cancel()
        await self._payments.save(payment)
        listing = await _own(self._repo, seller_id, payment.listing_id)
        return _mine(listing, await self._payments.list_for_seller(seller_id))


@dataclass(frozen=True)
class PendingPayment:
    payment: ListingPayment
    listing: Listing


class ListPendingPayments:
    def __init__(self, repo: ListingRepository, payments: PaymentRepository) -> None:
        self._repo = repo
        self._payments = payments

    async def __call__(self) -> list[PendingPayment]:
        rows = []
        for payment in await self._payments.list_pending():
            listing = await self._repo.get(payment.listing_id)
            if listing:
                rows.append(PendingPayment(payment, listing))
        return rows


class ApprovePayment:
    """El administrador vio el pago: la publicación queda visible 30 días más (si aún le quedaba
    tiempo pagado, el mes nuevo empieza cuando termine)."""

    def __init__(
        self,
        repo: ListingRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID) -> ListingPayment:
        payment = await self._payments.get(payment_id)
        listing = await self._repo.get(payment.listing_id) if payment else None
        if payment is None or listing is None:
            raise PaymentNotFound()
        now = self._clock.now()
        starts = listing.paid_until if listing.paid_until and listing.paid_until > now else now
        payment.approve(starts, now)
        listing.paid_until = payment.expires_at
        await self._payments.save(payment)
        await self._repo.save(listing)
        await self._notifier.notify(
            listing.seller_id,
            "listing_activated",
            "Tu publicación está activa",
            f"Confirmamos el pago de “{listing.title}”. Se verá en MarquetNeira hasta el "
            f"{_day(payment.expires_at or now)}.",
            MY_LISTINGS,
        )
        return payment


class RejectPayment:
    def __init__(
        self,
        repo: ListingRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID, note: str) -> ListingPayment:
        payment = await self._payments.get(payment_id)
        if payment is None:
            raise PaymentNotFound()
        payment.reject(note, self._clock.now())
        await self._payments.save(payment)
        listing = await self._repo.get(payment.listing_id)
        title = listing.title if listing else "tu publicación"
        await self._notifier.notify(
            payment.seller_id,
            "listing_payment_rejected",
            "No pudimos confirmar tu pago",
            f"“{title}”: {payment.note.rstrip('.')}. Revisa el pago y vuelve a intentarlo.",
            MY_LISTINGS,
        )
        return payment


class ReportListing:
    """Un cliente reporta una publicación inadecuada; se avisa a los administradores."""

    def __init__(
        self,
        repo: ListingRepository,
        reports: ReportRepository,
        accounts: AccountsPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._reports = reports
        self._accounts = accounts
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, reporter_id: UUID, listing_id: UUID, reason: ReportReason, details: str
    ) -> Report:
        now = self._clock.now()
        listing = await self._repo.get(listing_id)
        if listing is None or not listing.is_public(now):
            raise ListingNotFound()
        if listing.seller_id == reporter_id:
            raise CannotReportOwnListing()
        if any(
            r.reporter_id == reporter_id and r.status is ReportStatus.OPEN
            for r in await self._reports.list_for_listing(listing_id)
        ):
            raise AlreadyReported()
        report = Report.create(listing_id, reporter_id, reason, details, now)
        await self._reports.add(report)
        for admin_id in await self._accounts.admin_ids():
            await self._notifier.notify(
                admin_id,
                "listing_reported",
                "Reportaron una publicación",
                f"“{listing.title}” en MarquetNeira. Revísala en el panel de administrador.",
                ADMIN_MARKETPLACE,
            )
        return report


@dataclass(frozen=True)
class ReportedListing:
    listing: Listing
    reports: list[Report]


class ListReportedListings:
    """Publicaciones con reportes abiertos, la que tiene el reporte más antiguo primero."""

    def __init__(self, repo: ListingRepository, reports: ReportRepository) -> None:
        self._repo = repo
        self._reports = reports

    async def __call__(self) -> list[ReportedListing]:
        grouped: dict[UUID, list[Report]] = {}
        for report in await self._reports.list_open():
            grouped.setdefault(report.listing_id, []).append(report)
        rows = []
        for listing_id, reports in grouped.items():
            listing = await self._repo.get(listing_id)
            if listing:
                rows.append(ReportedListing(listing, reports))
        return rows


class _CloseReports:
    def __init__(self, repo: ListingRepository, reports: ReportRepository, clock: Clock) -> None:
        self._repo = repo
        self._reports = reports
        self._clock = clock

    async def _close(self, listing_id: UUID, status: ReportStatus) -> Listing:
        listing = await self._repo.get(listing_id)
        if listing is None:
            raise ListingNotFound()
        now = self._clock.now()
        open_ = [
            r
            for r in await self._reports.list_for_listing(listing_id)
            if r.status is ReportStatus.OPEN
        ]
        for report in open_:
            report.close(status, now)
        await self._reports.save_all(open_)
        return listing


class DismissReports(_CloseReports):
    """El equipo revisó y la publicación está bien: se cierran sus reportes."""

    async def __call__(self, listing_id: UUID) -> Listing:
        return await self._close(listing_id, ReportStatus.DISMISSED)


class RemoveListing(_CloseReports):
    """El equipo la retira: deja de verse, el vendedor no la puede reactivar y se le avisa."""

    def __init__(
        self,
        repo: ListingRepository,
        reports: ReportRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        super().__init__(repo, reports, clock)
        self._notifier = notifier

    async def __call__(self, listing_id: UUID, note: str) -> Listing:
        note = " ".join(note.split())
        if not note:
            raise MissingNote()
        listing = await self._close(listing_id, ReportStatus.ACTIONED)
        listing.removed = True
        listing.removed_note = note[:300]
        await self._repo.save(listing)
        await self._notifier.notify(
            listing.seller_id,
            "listing_removed",
            "Retiramos una de tus publicaciones",
            f"“{listing.title}”: {listing.removed_note.rstrip('.')}.",
            MY_LISTINGS,
        )
        return listing


class RestoreListing:
    def __init__(self, repo: ListingRepository) -> None:
        self._repo = repo

    async def __call__(self, listing_id: UUID) -> Listing:
        listing = await self._repo.get(listing_id)
        if listing is None:
            raise ListingNotFound()
        listing.removed = False
        listing.removed_note = ""
        await self._repo.save(listing)
        return listing
