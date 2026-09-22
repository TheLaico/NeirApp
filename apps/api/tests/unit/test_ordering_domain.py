from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from neirapp.modules.ordering.domain.entities import (
    Order,
    OrderLine,
    StoreOrderStatus,
)
from neirapp.modules.ordering.domain.errors import (
    EmptyOrder,
    InvalidStoreOrderTransition,
    OutsideServiceArea,
)
from neirapp.modules.ordering.domain.geofence import is_within_neira

NOW = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)
LATER = NOW + timedelta(minutes=5)

NEIRA_CENTER = (5.1667, -75.5167)
MANIZALES = (5.0689, -75.5174)


def _line(price: int = 25_000, qty: int = 2) -> OrderLine:
    return OrderLine(product_id=uuid4(), name="Pizza margarita", price_cop=price, quantity=qty)


def _order() -> Order:
    return Order.create_empty(
        customer_id=uuid4(),
        delivery_lat=NEIRA_CENTER[0],
        delivery_lng=NEIRA_CENTER[1],
        delivery_notes="Casa azul, segundo piso",
        now=NOW,
    )


class TestGeofence:
    def test_dentro_de_neira(self) -> None:
        assert is_within_neira(*NEIRA_CENTER)

    def test_fuera_de_neira(self) -> None:
        assert not is_within_neira(*MANIZALES)


class TestOrderLine:
    def test_subtotal(self) -> None:
        line = _line(price=25_000, qty=3)
        assert line.subtotal_cop == 75_000


class TestOrderCreation:
    def test_create_empty_dentro_de_neira(self) -> None:
        order = _order()
        assert order.store_orders == []
        assert order.total_cop == 0
        assert order.delivery_notes == "Casa azul, segundo piso"

    def test_create_empty_fuera_de_neira_falla(self) -> None:
        with pytest.raises(OutsideServiceArea):
            Order.create_empty(
                customer_id=uuid4(),
                delivery_lat=MANIZALES[0],
                delivery_lng=MANIZALES[1],
                delivery_notes="",
                now=NOW,
            )

    def test_add_store_order_sin_lineas_falla(self) -> None:
        order = _order()
        with pytest.raises(EmptyOrder):
            order.add_store_order(
                store_id=uuid4(), store_name="Pizzería", store_owner_user_id=uuid4(), lines=[]
            )

    def test_add_store_order_nace_pendiente_de_pago(self) -> None:
        order = _order()
        store_order = order.add_store_order(
            store_id=uuid4(),
            store_name="Pizzería Napoli",
            store_owner_user_id=uuid4(),
            lines=[_line(price=25_000, qty=2), _line(price=10_000, qty=1)],
        )
        assert store_order.status == StoreOrderStatus.PENDING_PAYMENT
        assert store_order.subtotal_cop == 60_000
        assert store_order.order_id == order.id

    def test_total_cop_suma_todas_las_tiendas(self) -> None:
        order = _order()
        order.add_store_order(
            store_id=uuid4(), store_name="A", store_owner_user_id=uuid4(), lines=[_line(25_000, 1)]
        )
        order.add_store_order(
            store_id=uuid4(), store_name="B", store_owner_user_id=uuid4(), lines=[_line(3_000, 2)]
        )
        assert order.total_cop == 25_000 + 6_000

    def test_is_owned_by(self) -> None:
        order = _order()
        assert order.is_owned_by(order.customer_id)
        assert not order.is_owned_by(uuid4())


class TestStoreOrderTransitions:
    def _store_order(self):
        order = _order()
        owner = uuid4()
        store_order = order.add_store_order(
            store_id=uuid4(), store_name="Pizzería", store_owner_user_id=owner, lines=[_line()]
        )
        return store_order, owner

    def test_flujo_feliz_completo(self) -> None:
        store_order, _ = self._store_order()
        store_order.mark_paid(NOW)
        assert store_order.status == StoreOrderStatus.PAID
        store_order.accept(LATER)
        assert store_order.status == StoreOrderStatus.ACCEPTED
        assert store_order.updated_at == LATER
        store_order.start_preparing(LATER)
        assert store_order.status == StoreOrderStatus.PREPARING
        store_order.mark_ready(LATER)
        assert store_order.status == StoreOrderStatus.READY

    def test_rechazo_despues_de_pagado(self) -> None:
        store_order, _ = self._store_order()
        store_order.mark_paid(NOW)
        store_order.reject(LATER)
        assert store_order.status == StoreOrderStatus.REJECTED

    @pytest.mark.parametrize(
        "action",
        ["accept", "reject", "start_preparing", "mark_ready"],
    )
    def test_no_se_puede_saltar_directo_desde_pendiente_de_pago(self, action: str) -> None:
        store_order, _ = self._store_order()
        with pytest.raises(InvalidStoreOrderTransition):
            getattr(store_order, action)(NOW)

    def test_no_se_puede_aceptar_dos_veces(self) -> None:
        store_order, _ = self._store_order()
        store_order.mark_paid(NOW)
        store_order.accept(NOW)
        with pytest.raises(InvalidStoreOrderTransition):
            store_order.accept(NOW)

    def test_rejected_es_terminal(self) -> None:
        store_order, _ = self._store_order()
        store_order.mark_paid(NOW)
        store_order.reject(NOW)
        with pytest.raises(InvalidStoreOrderTransition):
            store_order.accept(NOW)
        with pytest.raises(InvalidStoreOrderTransition):
            store_order.start_preparing(NOW)

    def test_ready_es_terminal_en_esta_fase(self) -> None:
        store_order, _ = self._store_order()
        store_order.mark_paid(NOW)
        store_order.accept(NOW)
        store_order.start_preparing(NOW)
        store_order.mark_ready(NOW)
        with pytest.raises(InvalidStoreOrderTransition):
            store_order.mark_ready(NOW)

    def test_is_owned_by_store(self) -> None:
        store_order, owner = self._store_order()
        assert store_order.is_owned_by_store(owner)
        assert not store_order.is_owned_by_store(uuid4())
