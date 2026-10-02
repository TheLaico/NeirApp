from dataclasses import dataclass

from neirapp.modules.venues.application.use_cases import (
    AnswerBooking,
    CancelBooking,
    GetMyVenue,
    GetVenue,
    ListMyBookings,
    ListMyVenueReviews,
    ListVenueBookings,
    ListVenueReviews,
    ListVenues,
    ListVenuesForAdmin,
    RateVenue,
    ReplyToReview,
    RequestBooking,
    SaveMyVenue,
    SetFeatured,
)


@dataclass(frozen=True)
class VenuesApp:
    """Fachada del módulo Reservas (lugares que se reservan, sus reseñas y las reservas)."""

    get_my_venue: GetMyVenue
    save_my_venue: SaveMyVenue
    list_venues: ListVenues
    get_venue: GetVenue
    list_venue_reviews: ListVenueReviews
    rate_venue: RateVenue
    list_my_venue_reviews: ListMyVenueReviews
    reply_to_review: ReplyToReview
    request_booking: RequestBooking
    list_my_bookings: ListMyBookings
    cancel_booking: CancelBooking
    list_venue_bookings: ListVenueBookings
    answer_booking: AnswerBooking
    list_venues_for_admin: ListVenuesForAdmin
    set_featured: SetFeatured
