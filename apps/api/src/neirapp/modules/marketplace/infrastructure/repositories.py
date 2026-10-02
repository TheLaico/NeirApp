from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.marketplace.domain.listings import (
    Listing,
    ListingCategory,
    ListingKind,
    RentPeriod,
)
from neirapp.modules.marketplace.domain.payments import ListingPayment, PaymentStatus
from neirapp.modules.marketplace.domain.reports import Report, ReportReason, ReportStatus
from neirapp.modules.marketplace.infrastructure.models import (
    ListingModel,
    ListingPaymentModel,
    ReportModel,
)

_LISTING_FIELDS = (
    "seller_id",
    "seller_name",
    "title",
    "description",
    "quantity",
    "whatsapp",
    "price_cop",
    "negotiable",
    "is_active",
    "removed",
    "removed_note",
    "paid_until",
    "created_at",
    "updated_at",
)


def _listing(m: ListingModel) -> Listing:
    return Listing(
        id=m.id,
        kind=ListingKind(m.kind),
        category=ListingCategory(m.category),
        rent_period=RentPeriod(m.rent_period),
        photos=list(m.photos or []),
        **{name: getattr(m, name) for name in _LISTING_FIELDS},
    )


class SqlAlchemyListingRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, listing_id: UUID) -> Listing | None:
        async with self._session_factory() as session:
            model = await session.get(ListingModel, listing_id)
            return _listing(model) if model else None

    async def save(self, listing: Listing) -> None:
        async with self._session_factory() as session:
            model = await session.get(ListingModel, listing.id)
            if model is None:
                model = ListingModel(id=listing.id)
                session.add(model)
            for name in _LISTING_FIELDS:
                setattr(model, name, getattr(listing, name))
            model.kind = listing.kind.value
            model.category = listing.category.value
            model.rent_period = listing.rent_period.value
            model.photos = list(listing.photos)
            await session.commit()

    async def delete(self, listing_id: UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(ReportModel).where(ReportModel.listing_id == listing_id))
            await session.execute(
                delete(ListingPaymentModel).where(ListingPaymentModel.listing_id == listing_id)
            )
            await session.execute(delete(ListingModel).where(ListingModel.id == listing_id))
            await session.commit()

    async def list_all(self) -> list[Listing]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ListingModel).order_by(ListingModel.created_at.desc())
            )
            return [_listing(m) for m in result.scalars()]

    async def list_for_seller(self, seller_id: UUID) -> list[Listing]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ListingModel)
                .where(ListingModel.seller_id == seller_id)
                .order_by(ListingModel.created_at.desc())
            )
            return [_listing(m) for m in result.scalars()]


_PAYMENT_FIELDS = (
    "listing_id",
    "seller_id",
    "amount_cop",
    "reference",
    "note",
    "requested_at",
    "reviewed_at",
    "starts_at",
    "expires_at",
)


def _payment(m: ListingPaymentModel) -> ListingPayment:
    return ListingPayment(
        id=m.id,
        status=PaymentStatus(m.status),
        **{name: getattr(m, name) for name in _PAYMENT_FIELDS},
    )


class SqlAlchemyPaymentRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, payment_id: UUID) -> ListingPayment | None:
        async with self._session_factory() as session:
            model = await session.get(ListingPaymentModel, payment_id)
            return _payment(model) if model else None

    async def save(self, payment: ListingPayment) -> None:
        async with self._session_factory() as session:
            model = await session.get(ListingPaymentModel, payment.id)
            if model is None:
                model = ListingPaymentModel(id=payment.id)
                session.add(model)
            for name in _PAYMENT_FIELDS:
                setattr(model, name, getattr(payment, name))
            model.status = payment.status.value
            await session.commit()

    async def list_for_seller(self, seller_id: UUID) -> list[ListingPayment]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ListingPaymentModel)
                .where(ListingPaymentModel.seller_id == seller_id)
                .order_by(ListingPaymentModel.requested_at.desc())
            )
            return [_payment(m) for m in result.scalars()]

    async def list_pending(self) -> list[ListingPayment]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ListingPaymentModel)
                .where(ListingPaymentModel.status == PaymentStatus.PENDING.value)
                .order_by(ListingPaymentModel.requested_at)
            )
            return [_payment(m) for m in result.scalars()]


def _report(m: ReportModel) -> Report:
    return Report(
        id=m.id,
        listing_id=m.listing_id,
        reporter_id=m.reporter_id,
        reason=ReportReason(m.reason),
        details=m.details,
        status=ReportStatus(m.status),
        created_at=m.created_at,
        reviewed_at=m.reviewed_at,
    )


class SqlAlchemyReportRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def add(self, report: Report) -> None:
        async with self._session_factory() as session:
            session.add(
                ReportModel(
                    id=report.id,
                    listing_id=report.listing_id,
                    reporter_id=report.reporter_id,
                    reason=report.reason.value,
                    details=report.details,
                    status=report.status.value,
                    created_at=report.created_at,
                    reviewed_at=report.reviewed_at,
                )
            )
            await session.commit()

    async def list_open(self) -> list[Report]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ReportModel)
                .where(ReportModel.status == ReportStatus.OPEN.value)
                .order_by(ReportModel.created_at)
            )
            return [_report(m) for m in result.scalars()]

    async def list_for_listing(self, listing_id: UUID) -> list[Report]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ReportModel)
                .where(ReportModel.listing_id == listing_id)
                .order_by(ReportModel.created_at)
            )
            return [_report(m) for m in result.scalars()]

    async def save_all(self, reports: list[Report]) -> None:
        async with self._session_factory() as session:
            for report in reports:
                model = await session.get(ReportModel, report.id)
                if model is not None:
                    model.status = report.status.value
                    model.reviewed_at = report.reviewed_at
            await session.commit()
