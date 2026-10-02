from dataclasses import dataclass

from neirapp.modules.lodging.application.use_cases import (
    AnswerReservation,
    CancelReservation,
    GetHotel,
    GetMyHotel,
    ListHotelReservations,
    ListHotelReviews,
    ListHotels,
    ListHotelsForAdmin,
    ListMyHotelReviews,
    ListMyReservations,
    RateHotel,
    ReplyToReview,
    RequestReservation,
    SaveMyHotel,
    SetRecommended,
)


@dataclass(frozen=True)
class LodgingApp:
    """Fachada del módulo Hospedaje (hoteles, reseñas y reservas)."""

    get_my_hotel: GetMyHotel
    save_my_hotel: SaveMyHotel
    list_hotels: ListHotels
    get_hotel: GetHotel
    list_hotel_reviews: ListHotelReviews
    rate_hotel: RateHotel
    list_my_hotel_reviews: ListMyHotelReviews
    reply_to_review: ReplyToReview
    request_reservation: RequestReservation
    list_my_reservations: ListMyReservations
    cancel_reservation: CancelReservation
    list_hotel_reservations: ListHotelReservations
    answer_reservation: AnswerReservation
    list_hotels_for_admin: ListHotelsForAdmin
    set_recommended: SetRecommended
