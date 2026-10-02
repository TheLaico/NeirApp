from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.lodging.domain.hotels import Amenity, Hotel, HotelKind
from neirapp.modules.lodging.domain.reservations import Reservation, ReservationStatus
from neirapp.modules.lodging.domain.reviews import Rating, Review
from neirapp.modules.lodging.infrastructure.models import (
    HotelModel,
    HotelReviewModel,
    ReservationModel,
)

_HOTEL_FIELDS = (
    "name",
    "tagline",
    "description",
    "address",
    "lat",
    "lng",
    "phone",
    "whatsapp",
    "email",
    "price_from_cop",
    "photos",
    "check_in",
    "check_out",
    "is_listed",
    "is_recommended",
    "banner_url",
    "created_at",
    "updated_at",
)


def _hotel(m: HotelModel) -> Hotel:
    return Hotel(
        user_id=m.user_id,
        kind=HotelKind(m.kind),
        # Un servicio que ya no exista en el catálogo se ignora en vez de romper la lectura.
        amenities=[Amenity(a) for a in m.amenities if a in Amenity._value2member_map_],
        **{name: getattr(m, name) for name in _HOTEL_FIELDS},
    )


class SqlAlchemyHotelRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: UUID) -> Hotel | None:
        async with self._session_factory() as session:
            model = await session.get(HotelModel, user_id)
            return _hotel(model) if model else None

    async def save(self, hotel: Hotel) -> None:
        async with self._session_factory() as session:
            model = await session.get(HotelModel, hotel.user_id)
            if model is None:
                model = HotelModel(user_id=hotel.user_id)
                session.add(model)
            for name in _HOTEL_FIELDS:
                setattr(model, name, getattr(hotel, name))
            model.photos = list(hotel.photos)
            model.kind = hotel.kind.value
            model.amenities = [a.value for a in hotel.amenities]
            await session.commit()

    async def list_all(self) -> list[Hotel]:
        async with self._session_factory() as session:
            result = await session.execute(select(HotelModel).order_by(HotelModel.name))
            return [_hotel(m) for m in result.scalars()]


_REVIEW_FIELDS = (
    "hotel_id",
    "user_id",
    "author_name",
    "stars",
    "comment",
    "created_at",
    "updated_at",
    "reply",
    "replied_at",
)


def _review(m: HotelReviewModel) -> Review:
    return Review(id=m.id, **{name: getattr(m, name) for name in _REVIEW_FIELDS})


class SqlAlchemyReviewRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, review_id: UUID) -> Review | None:
        async with self._session_factory() as session:
            model = await session.get(HotelReviewModel, review_id)
            return _review(model) if model else None

    async def get_by(self, hotel_id: UUID, user_id: UUID) -> Review | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(HotelReviewModel).where(
                    HotelReviewModel.hotel_id == hotel_id, HotelReviewModel.user_id == user_id
                )
            )
            model = result.scalar_one_or_none()
            return _review(model) if model else None

    async def save(self, review: Review) -> None:
        async with self._session_factory() as session:
            model = await session.get(HotelReviewModel, review.id)
            if model is None:
                model = HotelReviewModel(id=review.id)
                session.add(model)
            for name in _REVIEW_FIELDS:
                setattr(model, name, getattr(review, name))
            await session.commit()

    async def list_for(self, hotel_id: UUID) -> list[Review]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(HotelReviewModel)
                .where(HotelReviewModel.hotel_id == hotel_id)
                .order_by(HotelReviewModel.created_at.desc())
            )
            return [_review(m) for m in result.scalars()]

    async def ratings(self) -> dict[UUID, Rating]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(
                    HotelReviewModel.hotel_id,
                    func.avg(HotelReviewModel.stars),
                    func.count(HotelReviewModel.id),
                ).group_by(HotelReviewModel.hotel_id)
            )
            return {
                hotel_id: Rating(round(float(avg), 1), int(count))
                for hotel_id, avg, count in result.all()
            }


_RESERVATION_FIELDS = (
    "hotel_id",
    "customer_id",
    "customer_name",
    "phone",
    "check_in",
    "check_out",
    "guests",
    "rooms",
    "message",
    "hotel_note",
    "created_at",
    "updated_at",
)


def _reservation(m: ReservationModel) -> Reservation:
    return Reservation(
        id=m.id,
        status=ReservationStatus(m.status),
        **{name: getattr(m, name) for name in _RESERVATION_FIELDS},
    )


class SqlAlchemyReservationRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, reservation_id: UUID) -> Reservation | None:
        async with self._session_factory() as session:
            model = await session.get(ReservationModel, reservation_id)
            return _reservation(model) if model else None

    async def save(self, reservation: Reservation) -> None:
        async with self._session_factory() as session:
            model = await session.get(ReservationModel, reservation.id)
            if model is None:
                model = ReservationModel(id=reservation.id)
                session.add(model)
            for name in _RESERVATION_FIELDS:
                setattr(model, name, getattr(reservation, name))
            model.status = reservation.status.value
            await session.commit()

    async def _list(self, column: Any, value: UUID) -> list[Reservation]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ReservationModel)
                .where(column == value)
                .order_by(ReservationModel.created_at.desc())
            )
            return [_reservation(m) for m in result.scalars()]

    async def list_for_customer(self, customer_id: UUID) -> list[Reservation]:
        return await self._list(ReservationModel.customer_id, customer_id)

    async def list_for_hotel(self, hotel_id: UUID) -> list[Reservation]:
        return await self._list(ReservationModel.hotel_id, hotel_id)
