from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from neirapp.modules.dispatch.application.couriers import CreateCourierProfileCommand
from neirapp.modules.dispatch.application.deliveries import suggested_stop_order
from neirapp.modules.dispatch.presentation.dependencies import DispatchDep
from neirapp.modules.dispatch.presentation.schemas import (
    ClaimableOrderResponse,
    ConfirmDeliveryRequest,
    ConfirmPickupRequest,
    CourierProfileResponse,
    CreateCourierProfileRequest,
    CustomerDeliveryResponse,
    DeliveryResponse,
    DeliveryStopResponse,
    SetCourierVerificationRequest,
)
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
async def my_active_delivery(user: CurrentUser, dispatch: DispatchDep) -> DeliveryResponse | None:
    delivery = await dispatch.get_my_active_delivery(user.id)
    if delivery is None:
        return None
    return DeliveryResponse.from_domain(delivery, suggested_stop_order(delivery))


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
    return CustomerDeliveryResponse.from_domain(delivery) if delivery else None
