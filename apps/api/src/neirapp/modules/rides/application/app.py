from dataclasses import dataclass

from neirapp.modules.rides.application.use_cases import (
    AcceptRide,
    CancelRide,
    CompleteRide,
    GetCurrentRide,
    GetDriverCurrentRide,
    GetEarnings,
    GetMyDriver,
    GetRide,
    ListLiveDrivers,
    ListMyRides,
    ListNearbyRequests,
    MarkArrived,
    RateRide,
    RequestRide,
    SaveMyDriver,
    SetOnline,
    ShareLocation,
    StartRide,
    UpdateDriverLocation,
)


@dataclass(frozen=True)
class RidesApp:
    """Fachada del módulo Transporte (motocarros en tiempo real)."""

    get_my_driver: GetMyDriver
    save_my_driver: SaveMyDriver
    set_online: SetOnline
    update_driver_location: UpdateDriverLocation
    list_live_drivers: ListLiveDrivers
    request_ride: RequestRide
    get_current_ride: GetCurrentRide
    get_ride: GetRide
    list_my_rides: ListMyRides
    share_location: ShareLocation
    cancel_ride: CancelRide
    rate_ride: RateRide
    list_nearby_requests: ListNearbyRequests
    accept_ride: AcceptRide
    mark_arrived: MarkArrived
    start_ride: StartRide
    complete_ride: CompleteRide
    get_driver_current_ride: GetDriverCurrentRide
    get_earnings: GetEarnings
