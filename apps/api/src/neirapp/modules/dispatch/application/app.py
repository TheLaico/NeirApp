from dataclasses import dataclass

from neirapp.modules.dispatch.application.couriers import (
    CreateCourierProfile,
    GetMyCourierProfile,
    ListPendingCouriers,
    VerifyCourier,
)
from neirapp.modules.dispatch.application.deliveries import (
    CancelDelivery,
    ClaimDelivery,
    ConfirmDelivery,
    ConfirmPickup,
    GetDeliveryCourierUserIdRaw,
    GetDeliveryForCustomer,
    GetMyActiveDelivery,
    ListAvailableDeliveries,
    ListMyDeliveryHistory,
)


@dataclass(frozen=True)
class DispatchApp:
    create_courier_profile: CreateCourierProfile
    get_my_courier_profile: GetMyCourierProfile
    list_pending_couriers: ListPendingCouriers
    verify_courier: VerifyCourier

    list_available_deliveries: ListAvailableDeliveries
    claim_delivery: ClaimDelivery
    get_my_active_delivery: GetMyActiveDelivery
    list_my_delivery_history: ListMyDeliveryHistory
    confirm_pickup: ConfirmPickup
    confirm_delivery: ConfirmDelivery
    cancel_delivery: CancelDelivery
    get_delivery_for_customer: GetDeliveryForCustomer

    # Consumo interno de `incidents` (nunca por HTTP).
    get_delivery_courier_user_id_raw: GetDeliveryCourierUserIdRaw
