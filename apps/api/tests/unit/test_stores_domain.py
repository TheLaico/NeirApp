from datetime import UTC, datetime
from uuid import uuid4

import pytest

from neirapp.modules.stores.domain.entities import Product, Store, StoreCategory
from neirapp.modules.stores.domain.errors import (
    InvalidPrice,
    InvalidProductName,
    InvalidStoreName,
    OutsideServiceArea,
)
from neirapp.modules.stores.domain.geofence import is_within_neira

NOW = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)

# Centro aproximado del casco urbano de Neira, Caldas.
NEIRA_CENTER = (5.1667, -75.5167)
MANIZALES = (5.0689, -75.5174)  # ciudad vecina, fuera del municipio


class TestGeofence:
    def test_el_centro_de_neira_esta_dentro(self) -> None:
        assert is_within_neira(*NEIRA_CENTER)

    def test_un_municipio_vecino_esta_fuera(self) -> None:
        assert not is_within_neira(*MANIZALES)

    def test_coordenadas_lejanas_estan_fuera(self) -> None:
        assert not is_within_neira(4.6097, -74.0817)  # Bogotá


class TestStore:
    def test_crear_dentro_de_neira(self) -> None:
        store = Store.create(
            owner_user_id=uuid4(),
            name="  Tienda   Don José  ",
            category=StoreCategory.GENERAL,
            description="  La tienda de la esquina  ",
            lat=NEIRA_CENTER[0],
            lng=NEIRA_CENTER[1],
            now=NOW,
        )
        assert store.name == "Tienda Don José"
        assert store.description == "La tienda de la esquina"
        assert store.is_open is True

    def test_crear_fuera_de_neira_falla(self) -> None:
        with pytest.raises(OutsideServiceArea):
            Store.create(
                owner_user_id=uuid4(),
                name="Tienda",
                category=StoreCategory.GENERAL,
                description="",
                lat=MANIZALES[0],
                lng=MANIZALES[1],
                now=NOW,
            )

    def test_nombre_invalido(self) -> None:
        with pytest.raises(InvalidStoreName):
            Store.create(
                owner_user_id=uuid4(),
                name="A",
                category=StoreCategory.GENERAL,
                description="",
                lat=NEIRA_CENTER[0],
                lng=NEIRA_CENTER[1],
                now=NOW,
            )

    def test_relocate_fuera_de_neira_falla_y_no_muta(self) -> None:
        store = Store.create(
            owner_user_id=uuid4(),
            name="Tienda",
            category=StoreCategory.GENERAL,
            description="",
            lat=NEIRA_CENTER[0],
            lng=NEIRA_CENTER[1],
            now=NOW,
        )
        with pytest.raises(OutsideServiceArea):
            store.relocate(lat=MANIZALES[0], lng=MANIZALES[1])
        assert (store.lat, store.lng) == NEIRA_CENTER

    def test_is_owned_by(self) -> None:
        owner = uuid4()
        store = Store.create(
            owner_user_id=owner,
            name="Tienda",
            category=StoreCategory.GENERAL,
            description="",
            lat=NEIRA_CENTER[0],
            lng=NEIRA_CENTER[1],
            now=NOW,
        )
        assert store.is_owned_by(owner)
        assert not store.is_owned_by(uuid4())

    def test_set_open(self) -> None:
        store = Store.create(
            owner_user_id=uuid4(),
            name="Tienda",
            category=StoreCategory.GENERAL,
            description="",
            lat=NEIRA_CENTER[0],
            lng=NEIRA_CENTER[1],
            now=NOW,
        )
        store.set_open(False)
        assert store.is_open is False


class TestProduct:
    def test_crear_producto(self) -> None:
        product = Product.create(
            store_id=uuid4(),
            name="  Pizza margarita  ",
            description="Con albahaca fresca",
            price_cop=25_000,
            image_url=None,
            now=NOW,
        )
        assert product.name == "Pizza margarita"
        assert product.is_available is True

    @pytest.mark.parametrize("price", [0, -100, 50_000_001])
    def test_precio_invalido(self, price: int) -> None:
        with pytest.raises(InvalidPrice):
            Product.create(
                store_id=uuid4(),
                name="Producto",
                description="",
                price_cop=price,
                image_url=None,
                now=NOW,
            )

    def test_nombre_invalido(self) -> None:
        with pytest.raises(InvalidProductName):
            Product.create(
                store_id=uuid4(), name="A", description="", price_cop=1000, image_url=None, now=NOW
            )

    def test_update_parcial_no_toca_lo_no_enviado(self) -> None:
        product = Product.create(
            store_id=uuid4(),
            name="Pizza",
            description="Clásica",
            price_cop=20_000,
            image_url=None,
            now=NOW,
        )
        product.update(price_cop=22_000)
        assert product.name == "Pizza"
        assert product.description == "Clásica"
        assert product.price_cop == 22_000

    def test_update_con_precio_invalido_no_muta(self) -> None:
        product = Product.create(
            store_id=uuid4(),
            name="Pizza",
            description="",
            price_cop=20_000,
            image_url=None,
            now=NOW,
        )
        with pytest.raises(InvalidPrice):
            product.update(price_cop=-5)
        assert product.price_cop == 20_000

    def test_set_available(self) -> None:
        product = Product.create(
            store_id=uuid4(),
            name="Pizza",
            description="",
            price_cop=20_000,
            image_url=None,
            now=NOW,
        )
        product.set_available(False)
        assert product.is_available is False
