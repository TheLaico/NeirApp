import contextlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response

from neirapp.modules.dispatch.application.couriers import CreateCourierProfileCommand
from neirapp.modules.dispatch.application.deliveries import suggested_stop_order
from neirapp.modules.dispatch.domain.entities import VehicleType
from neirapp.modules.dispatch.presentation.dependencies import DispatchDep
from neirapp.modules.dispatch.presentation.schemas import (
    ClaimableOrderResponse,
    ConfirmDeliveryRequest,
    ConfirmPickupRequest,
    CourierProfileResponse,
    CourierRatingAdminResponse,
    CreateCourierProfileRequest,
    CustomerDeliveryResponse,
    DeliveryResponse,
    DeliveryStopResponse,
    EarningsSummaryResponse,
    LiveCourierResponse,
    LiveStopResponse,
    MyCourierRatingResponse,
    RateCourierRequest,
    SetCourierVerificationRequest,
    SetVehicleTypeEnabledRequest,
    UpdateLocationRequest,
    VehicleTypeResponse,
)
from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(tags=["dispatch"])


# --- Perfil de repartidor -----------------------------------------------------


@router.post("/couriers/me", response_model=CourierProfileResponse, status_code=201)
async def create_courier_profile(
    body: CreateCourierProfileRequest, user: CurrentUser, dispatch: DispatchDep
) -> CourierProfileResponse:
    profile = await dispatch.create_courier_profile(
        user.id,
        CreateCourierProfileCommand(
            vehicle_type=body.vehicle_type,
            plate=body.plate,
            id_document_number=body.id_document_number,
        ),
    )
    return CourierProfileResponse.from_domain(profile)


@router.get("/couriers/me", response_model=CourierProfileResponse | None)
async def my_courier_profile(
    user: CurrentUser, dispatch: DispatchDep
) -> CourierProfileResponse | None:
    profile = await dispatch.get_my_courier_profile(user.id)
    return CourierProfileResponse.from_domain(profile) if profile else None


@router.get("/couriers/vehicle-types", response_model=list[VehicleTypeResponse])
async def list_vehicle_types(
    _user: CurrentUser, dispatch: DispatchDep
) -> list[VehicleTypeResponse]:
    """Tipos de vehículo y si están habilitados para registrarse como repartidor."""
    return VehicleTypeResponse.from_map(await dispatch.list_vehicle_types())


@router.put("/couriers/vehicle-types/{vehicle_type}", response_model=list[VehicleTypeResponse])
async def set_vehicle_type_enabled(
    vehicle_type: VehicleType,
    body: SetVehicleTypeEnabledRequest,
    _admin: RequireAdmin,
    dispatch: DispatchDep,
) -> list[VehicleTypeResponse]:
    """Habilita o deshabilita un tipo de vehículo (solo admin)."""
    enabled = await dispatch.set_vehicle_type_enabled(vehicle_type, is_enabled=body.is_enabled)
    return VehicleTypeResponse.from_map(enabled)


@router.put("/couriers/me/location", status_code=204)
async def update_my_location(
    body: UpdateLocationRequest, user: CurrentUser, dispatch: DispatchDep
) -> Response:
    """El repartidor verificado reporta su posición actual (la app lo hace cada pocos segundos)."""
    await dispatch.update_my_location(user.id, lat=body.lat, lng=body.lng, heading=body.heading)
    return Response(status_code=204)


@router.get("/couriers/live", response_model=list[LiveCourierResponse])
async def list_live_couriers(
    _admin: RequireAdmin, dispatch: DispatchDep, request: Request
) -> list[LiveCourierResponse]:
    """Mapa en vivo (solo admin): posición de los repartidores y su entrega en curso."""
    identity: IdentityApp = request.app.state.identity
    result: list[LiveCourierResponse] = []
    for live in await dispatch.list_live_couriers():
        name, email = "Repartidor", ""
        with contextlib.suppress(Exception):  # un usuario borrado no rompe el mapa
            person = (await identity.get_profile(live.courier_id)).user
            name, email = person.full_name, person.email
        result.append(
            LiveCourierResponse(
                courier_id=live.courier_id,
                name=name,
                email=email,
                vehicle_type=live.vehicle_type,
                plate=live.plate,
                lat=live.lat,
                lng=live.lng,
                heading=live.heading,
                updated_at=live.updated_at,
                is_online=live.is_online,
                active_order_id=live.active_order_id,
                stops_picked_up=live.stops_picked_up,
                stops_total=live.stops_total,
                stops=[
                    LiveStopResponse(
                        store_name=s.store_name,
                        lat=s.lat,
                        lng=s.lng,
                        is_picked_up=s.is_picked_up,
                    )
                    for s in live.stops
                ],
                delivery_lat=live.delivery_lat,
                delivery_lng=live.delivery_lng,
            )
        )
    return result


@router.get("/couriers/pending", response_model=list[CourierProfileResponse])
async def list_pending_couriers(
    _admin: RequireAdmin, dispatch: DispatchDep
) -> list[CourierProfileResponse]:
    profiles = await dispatch.list_pending_couriers()
    return [CourierProfileResponse.from_domain(p) for p in profiles]


@router.patch("/couriers/{profile_id}/verification", response_model=CourierProfileResponse)
async def verify_courier(
    profile_id: UUID,
    body: SetCourierVerificationRequest,
    _admin: RequireAdmin,
    dispatch: DispatchDep,
) -> CourierProfileResponse:
    profile = await dispatch.verify_courier(profile_id, is_verified=body.is_verified)
    return CourierProfileResponse.from_domain(profile)


# --- Entregas disponibles y activas -------------------------------------------


@router.get("/deliveries/available", response_model=list[ClaimableOrderResponse])
async def list_available_deliveries(
    user: CurrentUser, dispatch: DispatchDep
) -> list[ClaimableOrderResponse]:
    orders = await dispatch.list_available_deliveries(user.id)
    return [ClaimableOrderResponse.from_domain(o) for o in orders]


@router.post("/deliveries/{order_id}/claim", response_model=DeliveryResponse, status_code=201)
async def claim_delivery(
    order_id: UUID, user: CurrentUser, dispatch: DispatchDep
) -> DeliveryResponse:
    delivery = await dispatch.claim_delivery(order_id, user.id)
    return DeliveryResponse.from_domain(delivery, suggested_stop_order(delivery))


@router.get("/deliveries/mine/active", response_model=DeliveryResponse | None)
async def my_active_delivery(
    user: CurrentUser, dispatch: DispatchDep, request: Request
) -> DeliveryResponse | None:
    delivery = await dispatch.get_my_active_delivery(user.id)
    if delivery is None:
        return None
    ready = await dispatch.get_ready_store_order_ids(delivery)
    response = DeliveryResponse.from_domain(delivery, suggested_stop_order(delivery), ready)
    # El repartidor puede llamar al cliente mientras la entrega está en curso (y solo entonces).
    customer_id = await dispatch.get_delivery_customer_id(delivery)
    if customer_id is not None:
        identity: IdentityApp = request.app.state.identity
        with contextlib.suppress(Exception):  # sin contacto no se rompe la entrega
            customer = (await identity.get_profile(customer_id)).user
            response.customer_name = customer.full_name
            response.customer_phone = customer.phone
    return response


@router.get("/deliveries/earnings-summary", response_model=EarningsSummaryResponse)
async def earnings_summary(_admin: RequireAdmin, dispatch: DispatchDep) -> EarningsSummaryResponse:
    """Lo acumulado por envíos entregados: repartidores y plataforma (solo admin)."""
    summary = await dispatch.get_earnings_summary()
    return EarningsSummaryResponse(
        deliveries=summary.deliveries,
        courier_cop=summary.courier_cop,
        platform_cop=summary.platform_cop,
    )


@router.get("/deliveries/mine/history", response_model=list[DeliveryResponse])
async def my_delivery_history(user: CurrentUser, dispatch: DispatchDep) -> list[DeliveryResponse]:
    deliveries = await dispatch.list_my_delivery_history(user.id)
    return [DeliveryResponse.from_domain(d, suggested_stop_order(d)) for d in deliveries]


@router.post("/deliveries/{delivery_id}/confirm-delivery", response_model=DeliveryResponse)
async def confirm_delivery(
    delivery_id: UUID, body: ConfirmDeliveryRequest, user: CurrentUser, dispatch: DispatchDep
) -> DeliveryResponse:
    delivery = await dispatch.confirm_delivery(delivery_id, user.id, body.code)
    return DeliveryResponse.from_domain(delivery, suggested_stop_order(delivery))


@router.post("/deliveries/{delivery_id}/cancel", response_model=DeliveryResponse)
async def cancel_delivery(
    delivery_id: UUID, user: CurrentUser, dispatch: DispatchDep
) -> DeliveryResponse:
    delivery = await dispatch.cancel_delivery(delivery_id, user.id)
    return DeliveryResponse.from_domain(delivery, suggested_stop_order(delivery))


# --- Confirmación de recogida (la hace la tienda) y de entrega (la ve el cliente) --------------


@router.post(
    "/deliveries/store-orders/{store_order_id}/confirm-pickup", response_model=DeliveryStopResponse
)
async def confirm_pickup(
    store_order_id: UUID, body: ConfirmPickupRequest, user: CurrentUser, dispatch: DispatchDep
) -> DeliveryStopResponse:
    stop = await dispatch.confirm_pickup(store_order_id, user.id, body.code)
    return DeliveryStopResponse.from_domain(stop)


@router.get("/deliveries/by-order/{order_id}", response_model=CustomerDeliveryResponse | None)
async def delivery_for_customer(
    order_id: UUID, user: CurrentUser, dispatch: DispatchDep
) -> CustomerDeliveryResponse | None:
    delivery = await dispatch.get_delivery_for_customer(order_id, user.id)
    if delivery is None:
        return None
    response = CustomerDeliveryResponse.from_domain(delivery)
    mine = await dispatch.get_my_courier_rating(delivery)
    if mine is not None:
        response.my_rating = MyCourierRatingResponse(rating=mine.rating, comment=mine.comment)
    return response


@router.post(
    "/deliveries/by-order/{order_id}/rating",
    response_model=MyCourierRatingResponse,
    status_code=201,
)
async def rate_courier(
    order_id: UUID, body: RateCourierRequest, user: CurrentUser, dispatch: DispatchDep
) -> MyCourierRatingResponse:
    """El cliente califica en privado al repartidor de su pedido entregado."""
    created = await dispatch.rate_courier(
        order_id, user.id, rating=body.rating, comment=body.comment
    )
    return MyCourierRatingResponse(rating=created.rating, comment=created.comment)


@router.get("/deliveries/courier-ratings", response_model=list[CourierRatingAdminResponse])
async def list_courier_ratings(
    _admin: RequireAdmin, dispatch: DispatchDep, request: Request
) -> list[CourierRatingAdminResponse]:
    """Calificaciones que los clientes dieron a los repartidores (solo admin: no son públicas)."""
    ratings = await dispatch.list_courier_ratings()
    identity: IdentityApp = request.app.state.identity
    people: dict[UUID, tuple[str, str]] = {}
    for courier_id in {r.courier_id for r in ratings}:
        try:
            profile = await identity.get_profile(courier_id)
            people[courier_id] = (profile.user.full_name, profile.user.email)
        except Exception:
            people[courier_id] = ("Repartidor", "")
    return [
        CourierRatingAdminResponse(
            id=r.id,
            order_id=r.order_id,
            courier_id=r.courier_id,
            courier_name=people[r.courier_id][0],
            courier_email=people[r.courier_id][1],
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
        )
        for r in ratings
    ]
