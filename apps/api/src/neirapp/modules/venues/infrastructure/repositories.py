from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.venues.domain.bookings import Booking, BookingStatus
from neirapp.modules.venues.domain.reviews import Rating, Review
from neirapp.modules.venues.domain.venues import Feature, PriceUnit, Venue, VenueCategory
from neirapp.modules.venues.infrastructure.models import (
    BookingModel,
    VenueModel,
    VenueReviewModel,
)

_VENUE_FIELDS = (
    "name",
    "tagline",
    "description",
    "address",
    "lat",
    "lng",
    "phone",
    "whatsapp",
    "email",
    "photos",
    "open_time",
    "close_time",
    "open_days",
    "max_people",
    "price_cop",
    "is_listed",
    "is_featured",
    "banner_url",
    "created_at",
    "updated_at",
)


def _venue(m: VenueModel) -> Venue:
    return Venue(
        user_id=m.user_id,
        category=VenueCategory(m.category),
        price_unit=PriceUnit(m.price_unit),
        # Un servicio que ya no exista en el catálogo se ignora en vez de romper la lectura.
        features=[Feature(f) for f in m.features if f in Feature._value2member_map_],
        **{name: getattr(m, name) for name in _VENUE_FIELDS},
    )


class SqlAlchemyVenueRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: UUID) -> Venue | None:
        async with self._session_factory() as session:
            model = await session.get(VenueModel, user_id)
            return _venue(model) if model else None

    async def save(self, venue: Venue) -> None:
        async with self._session_factory() as session:
            model = await session.get(VenueModel, venue.user_id)
            if model is None:
                model = VenueModel(user_id=venue.user_id)
                session.add(model)
            for name in _VENUE_FIELDS:
                setattr(model, name, getattr(venue, name))
            model.photos = list(venue.photos)
            model.open_days = list(venue.open_days)
            model.category = venue.category.value
            model.price_unit = venue.price_unit.value
            model.features = [f.value for f in venue.features]
            await session.commit()

    async def list_all(self) -> list[Venue]:
        async with self._session_factory() as session:
            result = await session.execute(select(VenueModel).order_by(VenueModel.name))
            return [_venue(m) for m in result.scalars()]


_REVIEW_FIELDS = (
    "venue_id",
    "user_id",
    "author_name",
    "stars",
    "comment",
    "created_at",
    "updated_at",
    "reply",
    "replied_at",
)


def _review(m: VenueReviewModel) -> Review:
    return Review(id=m.id, **{name: getattr(m, name) for name in _REVIEW_FIELDS})


class SqlAlchemyReviewRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, review_id: UUID) -> Review | None:
        async with self._session_factory() as session:
            model = await session.get(VenueReviewModel, review_id)
            return _review(model) if model else None

    async def get_by(self, venue_id: UUID, user_id: UUID) -> Review | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(VenueReviewModel).where(
                    VenueReviewModel.venue_id == venue_id, VenueReviewModel.user_id == user_id
                )
            )
            model = result.scalar_one_or_none()
            return _review(model) if model else None

    async def save(self, review: Review) -> None:
        async with self._session_factory() as session:
            model = await session.get(VenueReviewModel, review.id)
            if model is None:
                model = VenueReviewModel(id=review.id)
                session.add(model)
            for name in _REVIEW_FIELDS:
                setattr(model, name, getattr(review, name))
            await session.commit()

    async def list_for(self, venue_id: UUID) -> list[Review]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(VenueReviewModel)
                .where(VenueReviewModel.venue_id == venue_id)
                .order_by(VenueReviewModel.created_at.desc())
            )
            return [_review(m) for m in result.scalars()]

    async def ratings(self) -> dict[UUID, Rating]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(
                    VenueReviewModel.venue_id,
                    func.avg(VenueReviewModel.stars),
                    func.count(VenueReviewModel.id),
                ).group_by(VenueReviewModel.venue_id)
            )
            return {
                venue_id: Rating(round(float(avg), 1), int(count))
                for venue_id, avg, count in result.all()
            }


_BOOKING_FIELDS = (
    "venue_id",
    "customer_id",
    "customer_name",
    "phone",
    "day",
    "at",
    "people",
    "message",
    "venue_note",
    "created_at",
    "updated_at",
)


def _booking(m: BookingModel) -> Booking:
    return Booking(
        id=m.id,
        status=BookingStatus(m.status),
        **{name: getattr(m, name) for name in _BOOKING_FIELDS},
    )


class SqlAlchemyBookingRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, booking_id: UUID) -> Booking | None:
        async with self._session_factory() as session:
            model = await session.get(BookingModel, booking_id)
            return _booking(model) if model else None

    async def save(self, booking: Booking) -> None:
        async with self._session_factory() as session:
            model = await session.get(BookingModel, booking.id)
            if model is None:
                model = BookingModel(id=booking.id)
                session.add(model)
            for name in _BOOKING_FIELDS:
                setattr(model, name, getattr(booking, name))
            model.status = booking.status.value
            await session.commit()

    async def _list(self, column: Any, value: UUID) -> list[Booking]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(BookingModel).where(column == value).order_by(BookingModel.created_at.desc())
            )
            return [_booking(m) for m in result.scalars()]

    async def list_for_customer(self, customer_id: UUID) -> list[Booking]:
        return await self._list(BookingModel.customer_id, customer_id)

    async def list_for_venue(self, venue_id: UUID) -> list[Booking]:
        return await self._list(BookingModel.venue_id, venue_id)
