from dataclasses import dataclass

from neirapp.modules.lodging.application.plans import (
    ApprovePlanPayment,
    CancelPlanPayment,
    EndPlan,
    GetMyBilling,
    GrantPlanMonth,
    ListHotelsForAdmin,
    RejectPlanPayment,
    RequestPlanPayment,
    SetBanner,
)
from neirapp.modules.lodging.application.use_cases import (
    AnswerReservation,
    CancelReservation,
    GetHotel,
    GetMyHotel,
    ListHotelReservations,
    ListHotelReviews,
    ListHotels,
    ListMyHotelReviews,
    ListMyReservations,
    RateHotel,
    ReplyToReview,
    RequestReservation,
    SaveMyHotel,
)


@dataclass(frozen=True)
class LodgingApp:
    """Fachada del módulo Hospedaje (hoteles, planes, reseñas y reservas)."""

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
    get_my_billing: GetMyBilling
    request_plan_payment: RequestPlanPayment
    cancel_plan_payment: CancelPlanPayment
    list_hotels_for_admin: ListHotelsForAdmin
    approve_plan_payment: ApprovePlanPayment
    reject_plan_payment: RejectPlanPayment
    grant_plan_month: GrantPlanMonth
    end_plan: EndPlan
    set_banner: SetBanner
