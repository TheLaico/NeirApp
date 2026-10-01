import pytest

from neirapp.modules.pricing.domain.entities import (
    DEFAULT_PRICING,
    DeliveryPricing,
    split_delivery_fee,
)
from neirapp.modules.pricing.domain.errors import InvalidCourierShare, InvalidDeliveryFee


class TestSplitDeliveryFee:
    def test_reparte_segun_el_porcentaje(self) -> None:
        assert split_delivery_fee(5_000, 80) == (4_000, 1_000)

    def test_lo_que_sobra_del_redondeo_es_de_la_plataforma(self) -> None:
        courier, platform = split_delivery_fee(3_333, 50)
        assert (courier, platform) == (1_666, 1_667)
        assert courier + platform == 3_333

    def test_extremos(self) -> None:
        assert split_delivery_fee(4_000, 0) == (0, 4_000)
        assert split_delivery_fee(4_000, 100) == (4_000, 0)


class TestDeliveryPricing:
    def test_por_defecto(self) -> None:
        assert DEFAULT_PRICING.courier_cop + DEFAULT_PRICING.platform_cop == 5_000
        assert DEFAULT_PRICING.platform_share_percent == 20

    @pytest.mark.parametrize("fee", [-1, 100_001])
    def test_valor_de_envio_fuera_de_rango(self, fee: int) -> None:
        with pytest.raises(InvalidDeliveryFee):
            DeliveryPricing(fee, 80)

    @pytest.mark.parametrize("share", [-1, 101])
    def test_porcentaje_fuera_de_rango(self, share: int) -> None:
        with pytest.raises(InvalidCourierShare):
            DeliveryPricing(5_000, share)
