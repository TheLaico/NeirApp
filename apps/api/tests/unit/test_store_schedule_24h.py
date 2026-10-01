from datetime import date, time, timedelta

import pytest

from neirapp.modules.stores.domain.errors import InvalidSchedule
from neirapp.modules.stores.domain.schedule import DayHours, StoreSchedule
from tests.unit.test_store_schedule import MONDAY, at


def all_day_week(off: tuple[int, ...] = ()) -> list[DayHours]:
    return [DayHours(d, False) if d in off else DayHours(d, True, all_day=True) for d in range(7)]


def test_24_7_esta_abierta_a_cualquier_hora() -> None:
    s = StoreSchedule()
    s.set_week(all_day_week())

    for hour in (0, 3, 7, 12, 23):
        assert s.closed_reason_at(at(MONDAY, hour)) is None
    assert s.closed_reason_at(at(MONDAY, 23, 59)) is None
    assert s.is_24_7


def test_24_7_solo_si_los_siete_dias_abren_todo_el_dia() -> None:
    s = StoreSchedule()

    s.set_week(all_day_week(off=(6,)))
    assert not s.is_24_7  # el domingo no abre

    days = all_day_week()
    days[2] = DayHours(2, True, time(8), time(20))
    s.set_week(days)
    assert not s.is_24_7  # el miércoles tiene horas

    assert not StoreSchedule().is_24_7  # sin horario tampoco cuenta


def test_un_dia_de_24_horas_ignora_las_horas_que_traiga() -> None:
    s = StoreSchedule()
    days = all_day_week()
    days[1] = DayHours(
        1, True, time(20), time(8), all_day=True
    )  # horas absurdas, pero abre todo el día

    s.set_week(days)

    assert s.days[1] == DayHours(1, True, all_day=True)
    assert s.closed_reason_at(at(MONDAY + timedelta(days=1), 3)) is None


def test_se_puede_mezclar_un_dia_de_24_horas_con_dias_de_horas() -> None:
    s = StoreSchedule()
    days = [DayHours(d, True, time(8), time(20)) for d in range(7)]
    days[4] = DayHours(4, True, all_day=True)  # viernes todo el día

    s.set_week(days)

    friday = MONDAY + timedelta(days=4)
    assert s.closed_reason_at(at(friday, 2)) is None
    assert s.closed_reason_at(at(MONDAY, 2)) is not None  # lunes a las 2 a. m.: cerrado
    assert not s.is_24_7


def test_un_dia_de_24_horas_sigue_exigiendo_los_siete_dias() -> None:
    with pytest.raises(InvalidSchedule):
        StoreSchedule().set_week(all_day_week()[:6])


def test_la_fecha_de_cierre_gana_incluso_en_24_7() -> None:
    s = StoreSchedule()
    s.set_week(all_day_week())
    s.add_closed_date(MONDAY, "Vacaciones", date(2026, 9, 21))

    assert s.closed_reason_at(at(MONDAY, 12)) is not None
    assert s.closed_reason_at(at(MONDAY + timedelta(days=1), 12)) is None


def test_la_proxima_apertura_tras_un_dia_libre_es_a_medianoche_si_el_siguiente_es_24_horas() -> (
    None
):
    s = StoreSchedule()
    days = all_day_week()
    days[0] = DayHours(0, False)  # el lunes no abre; el martes sí, 24 h
    s.set_week(days)

    assert s.next_open_after(at(MONDAY, 12)) == at(MONDAY + timedelta(days=1), 0)
