from dataclasses import dataclass

from neirapp.modules.dispatch.application.couriers import (
    CreateCourierProfile,
    GetMyCourierProfile,
    ListPendingCouriers,
    ListVehicleTypes,
    SetVehicleTypeEnabled,
    VerifyCourier,
)
from neirapp.modules.dispatch.application.deliveries import (
    CancelDelivery,
    ClaimDelivery,
    ConfirmDelivery,
    ConfirmPickup,
    GetDeliveryCourierUserIdRaw,
    GetDeliveryCustomerId,
    GetDeliveryForCustomer,
    GetEarningsSummary,
    GetMyActiveDelivery,
    GetMyCourierRating,
    GetReadyStoreOrderIds,
    ListAvailableDeliveries,
    ListCourierRatings,
    ListMyDeliveryHistory,
    RateCourier,
)
from neirapp.modules.dispatch.application.tracking import ListLiveCouriers, UpdateMyLocation


@dataclass(frozen=True)
class DispatchApp:
    create_courier_profile: CreateCourierProfile
    get_my_courier_profile: GetMyCourierProfile
    list_pending_couriers: ListPendingCouriers
    verify_courier: VerifyCourier
    list_vehicle_types: ListVehicleTypes
    set_vehicle_type_enabled: SetVehicleTypeEnabled

    list_available_deliveries: ListAvailableDeliveries
    claim_delivery: ClaimDelivery
    get_my_active_delivery: GetMyActiveDelivery
    list_my_delivery_history: ListMyDeliveryHistory
    get_ready_store_order_ids: GetReadyStoreOrderIds
    get_delivery_customer_id: GetDeliveryCustomerId
    get_earnings_summary: GetEarningsSummary
    rate_courier: RateCourier
    get_my_courier_rating: GetMyCourierRating
    list_courier_ratings: ListCourierRatings
    update_my_location: UpdateMyLocation
    list_live_couriers: ListLiveCouriers
    confirm_pickup: ConfirmPickup
    confirm_delivery: ConfirmDelivery
    cancel_delivery: CancelDelivery
    get_delivery_for_customer: GetDeliveryForCustomer

    # Consumo interno de `incidents` (nunca por HTTP).
    get_delivery_courier_user_id_raw: GetDeliveryCourierUserIdRaw
