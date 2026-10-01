from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from neirapp.modules.dispatch.domain.entities import (
    CourierProfile,
    Delivery,
    DeliveryStatus,
    VehicleType,
)
from neirapp.modules.dispatch.domain.errors import (
    DeliveryAlreadyFinished,
    InvalidDeliveryCode,
    InvalidPickupCode,
    InvalidPlate,
    NotAllStopsPickedUp,
    PickupAlreadyConfirmed,
    StopNotFound,
)
from neirapp.modules.dispatch.domain.routing import suggest_route

NOW = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)
LATER = NOW + timedelta(minutes=5)

NEIRA_CENTER = (5.1667, -75.5167)


def _stop_tuple(
    lat: float = NEIRA_CENTER[0], lng: float = NEIRA_CENTER[1]
) -> tuple[UUID, UUID, str, UUID, float, float]:
    return (uuid4(), uuid4(), "Pizzería", uuid4(), lat, lng)


class TestCourierProfile:
    def test_moto_requiere_placa_valida(self) -> None:
        profile = CourierProfile.create(
            user_id=uuid4(),
            vehicle_type=VehicleType.MOTORCYCLE,
            plate="abc123",
            id_document_number="123456789",
            now=NOW,
        )
        assert profile.plate == "ABC123"
        assert profile.is_verified is False

    def test_moto_sin_placa_falla(self) -> None:
        with pytest.raises(InvalidPlate):
            CourierProfile.create(
                user_id=uuid4(),
                vehicle_type=VehicleType.MOTORCYCLE,
                plate=None,
                id_document_number="123456789",
                now=NOW,
            )

    def test_bici_no_requiere_placa(self) -> None:
        profile = CourierProfile.create(
            user_id=uuid4(),
            vehicle_type=VehicleType.BIKE,
            plate=None,
            id_document_number="123456789",
            now=NOW,
        )
        assert profile.plate is None

    @pytest.mark.parametrize("plate", ["ab", "abcdefghi"])
    def test_placa_con_longitud_invalida_falla(self, plate: str) -> None:
        with pytest.raises(InvalidPlate):
            CourierProfile.create(
                user_id=uuid4(),
                vehicle_type=VehicleType.CAR,
                plate=plate,
                id_document_number="123456789",
                now=NOW,
            )

    def test_set_verified(self) -> None:
        profile = CourierProfile.create(
            user_id=uuid4(),
            vehicle_type=VehicleType.BIKE,
            plate=None,
            id_document_number="123456789",
            now=NOW,
        )
        profile.set_verified(True)
        assert profile.is_verified is True

    def test_is_owned_by(self) -> None:
        user_id = uuid4()
        profile = CourierProfile.create(
            user_id=user_id,
            vehicle_type=VehicleType.BIKE,
            plate=None,
            id_document_number="123456789",
            now=NOW,
        )
        assert profile.is_owned_by(user_id)
        assert not profile.is_owned_by(uuid4())


class TestDeliveryClaim:
    def test_claim_genera_codigos_por_cada_parada_y_uno_de_entrega(self) -> None:
        delivery = Delivery.claim(
            order_id=uuid4(),
            courier_id=uuid4(),
            stops=[_stop_tuple(), _stop_tuple()],
            delivery_lat=NEIRA_CENTER[0],
            delivery_lng=NEIRA_CENTER[1],
            now=NOW,
        )
        assert delivery.status == DeliveryStatus.ASSIGNED
        assert len(delivery.stops) == 2
        assert len({s.pickup_code for s in delivery.stops} | {delivery.delivery_code}) == 3
        assert not delivery.all_stops_picked_up


class TestDeliveryPickupAndDelivery:
    def _delivery(self, n_stops: int = 2) -> Delivery:
        return Delivery.claim(
            order_id=uuid4(),
            courier_id=uuid4(),
            stops=[_stop_tuple() for _ in range(n_stops)],
            delivery_lat=NEIRA_CENTER[0],
            delivery_lng=NEIRA_CENTER[1],
            now=NOW,
        )

    def test_confirmar_recogida_con_codigo_correcto(self) -> None:
        delivery = self._delivery(1)
        stop = delivery.stops[0]
        confirmed = delivery.confirm_pickup(stop.store_id, stop.pickup_code, LATER)
        assert confirmed.is_picked_up
        assert confirmed.picked_up_at == LATER

    def test_confirmar_recogida_con_codigo_incorrecto_falla(self) -> None:
        delivery = self._delivery(1)
        stop = delivery.stops[0]
        with pytest.raises(InvalidPickupCode):
            delivery.confirm_pickup(stop.store_id, "XXXXXX", LATER)

    def test_confirmar_recogida_dos_veces_falla(self) -> None:
        delivery = self._delivery(1)
        stop = delivery.stops[0]
        delivery.confirm_pickup(stop.store_id, stop.pickup_code, LATER)
        with pytest.raises(PickupAlreadyConfirmed):
            delivery.confirm_pickup(stop.store_id, stop.pickup_code, LATER)

    def test_confirmar_recogida_de_tienda_ajena_falla(self) -> None:
        delivery = self._delivery(1)
        with pytest.raises(StopNotFound):
            delivery.confirm_pickup(uuid4(), "XXXXXX", LATER)

    def test_confirmar_entrega_sin_recoger_todo_falla(self) -> None:
        delivery = self._delivery(2)
        delivery.confirm_pickup(delivery.stops[0].store_id, delivery.stops[0].pickup_code, LATER)
        with pytest.raises(NotAllStopsPickedUp):
            delivery.confirm_delivery(delivery.delivery_code, LATER)

    def test_confirmar_entrega_con_codigo_incorrecto_falla(self) -> None:
        delivery = self._delivery(1)
        delivery.confirm_pickup(delivery.stops[0].store_id, delivery.stops[0].pickup_code, LATER)
        with pytest.raises(InvalidDeliveryCode):
            delivery.confirm_delivery("XXXXXX", LATER)

    def test_flujo_completo_de_entrega(self) -> None:
        delivery = self._delivery(2)
        for stop in delivery.stops:
            delivery.confirm_pickup(stop.store_id, stop.pickup_code, LATER)
        assert delivery.all_stops_picked_up
        delivery.confirm_delivery(delivery.delivery_code, LATER)
        assert delivery.status == DeliveryStatus.DELIVERED
        assert delivery.delivered_at == LATER

    def test_no_se_puede_operar_una_entrega_ya_finalizada(self) -> None:
        delivery = self._delivery(1)
        delivery.confirm_pickup(delivery.stops[0].store_id, delivery.stops[0].pickup_code, LATER)
        delivery.confirm_delivery(delivery.delivery_code, LATER)
        with pytest.raises(DeliveryAlreadyFinished):
            delivery.confirm_delivery(delivery.delivery_code, LATER)

    def test_cancelar(self) -> None:
        delivery = self._delivery(1)
        delivery.cancel(LATER)
        assert delivery.status == DeliveryStatus.CANCELLED
        with pytest.raises(DeliveryAlreadyFinished):
            delivery.cancel(LATER)

    def test_is_owned_by_courier(self) -> None:
        delivery = self._delivery(1)
        assert delivery.is_owned_by_courier(delivery.courier_id)
        assert not delivery.is_owned_by_courier(uuid4())


class TestRouting:
    def test_sin_paradas(self) -> None:
        assert suggest_route([], NEIRA_CENTER[0], NEIRA_CENTER[1]) == []

    def test_visita_la_mas_cercana_primero(self) -> None:
        near_id, far_id = uuid4(), uuid4()
        stops = [
            (far_id, 5.20, -75.55),
            (near_id, 5.1670, -75.5170),
        ]
        # arranca en la primera parada de la lista (far_id) y de ahí visita por cercanía
        route = suggest_route(stops, NEIRA_CENTER[0], NEIRA_CENTER[1])
        assert route == [far_id, near_id]


class TestGenerateCode:
    def test_son_seis_digitos(self) -> None:
        from neirapp.modules.dispatch.domain.codes import generate_code

        for _ in range(200):
            code = generate_code()
            assert len(code) == 6
            assert code.isdigit()

    def test_no_repite_siempre_el_mismo(self) -> None:
        from neirapp.modules.dispatch.domain.codes import generate_code

        assert len({generate_code() for _ in range(50)}) > 1
