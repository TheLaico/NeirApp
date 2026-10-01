from datetime import UTC, date, datetime, time, timedelta
from uuid import uuid4

import pytest

from neirapp.modules.stores.domain.entities import Store, StoreCategory
from neirapp.modules.stores.domain.errors import InvalidClosedDate, InvalidSchedule
from neirapp.modules.stores.domain.schedule import (
    COLOMBIA,
    ClosedReason,
    DayHours,
    StoreSchedule,
)

# Lunes 21 de septiembre de 2026. Colombia es UTC-5: 12:00 UTC son las 07:00 allá.
MONDAY = date(2026, 9, 21)


def at(day: date, hour: int, minute: int = 0) -> datetime:
    """Momento (en UTC) que en Colombia es `day` a las `hour:minute`."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=COLOMBIA).astimezone(UTC)


def week(
    opens: time = time(8), closes: time = time(20), *, off: tuple[int, ...] = ()
) -> list[DayHours]:
    return [DayHours(d, False) if d in off else DayHours(d, True, opens, closes) for d in range(7)]


def schedule(**kwargs: object) -> StoreSchedule:
    s = StoreSchedule()
    s.set_week(week(**kwargs))  # type: ignore[arg-type]
    return s


class TestEstadoSegunElHorario:
    def test_sin_horario_esta_abierta_siempre(self) -> None:
        assert StoreSchedule().closed_reason_at(at(MONDAY, 3)) is None

    def test_dentro_y_fuera_de_hora(self) -> None:
        s = schedule()

        assert s.closed_reason_at(at(MONDAY, 7, 59)) == ClosedReason.OUTSIDE_HOURS
        assert s.closed_reason_at(at(MONDAY, 8)) is None  # abre a la hora en punto
        assert s.closed_reason_at(at(MONDAY, 19, 59)) is None
        assert s.closed_reason_at(at(MONDAY, 20)) == ClosedReason.OUTSIDE_HOURS  # cierra a la hora

    def test_dia_libre(self) -> None:
        s = schedule(off=(6,))  # domingo

        assert s.closed_reason_at(at(MONDAY + timedelta(days=6), 12)) == ClosedReason.DAY_OFF
        assert s.closed_reason_at(at(MONDAY, 12)) is None

    def test_se_interpreta_en_hora_de_colombia_no_en_utc(self) -> None:
        s = schedule()
        # 01:00 UTC del martes son las 20:00 del lunes en Colombia: ya cerró.
        tuesday_1am_utc = datetime(2026, 9, 22, 1, 0, tzinfo=UTC)

        assert s.closed_reason_at(tuesday_1am_utc) == ClosedReason.OUTSIDE_HOURS

    def test_fecha_de_cierre_gana_sobre_el_horario(self) -> None:
        s = schedule()
        s.add_closed_date(MONDAY, "Vacaciones", MONDAY)

        assert s.closed_reason_at(at(MONDAY, 12)) == ClosedReason.CLOSED_DATE
        assert s.closed_reason_at(at(MONDAY + timedelta(days=1), 12)) is None

    def test_fecha_de_cierre_sin_horario_tambien_cierra(self) -> None:
        s = StoreSchedule()
        s.add_closed_date(MONDAY, "", MONDAY)

        assert s.closed_reason_at(at(MONDAY, 12)) == ClosedReason.CLOSED_DATE


class TestProximaApertura:
    def test_antes_de_abrir_es_hoy(self) -> None:
        assert schedule().next_open_after(at(MONDAY, 7)) == at(MONDAY, 8)

    def test_despues_de_cerrar_es_manana(self) -> None:
        assert schedule().next_open_after(at(MONDAY, 21)) == at(MONDAY + timedelta(days=1), 8)

    def test_salta_dias_libres_y_fechas_de_cierre(self) -> None:
        s = schedule(off=(1,))  # los martes no abre
        s.add_closed_date(MONDAY + timedelta(days=2), "Feriado", MONDAY)  # miércoles

        # Lunes en la noche → martes libre → miércoles cerrado → jueves.
        assert s.next_open_after(at(MONDAY, 21)) == at(MONDAY + timedelta(days=3), 8)

    def test_sin_horario_no_hay_proxima_apertura(self) -> None:
        assert StoreSchedule().next_open_after(at(MONDAY, 21)) is None


class TestValidacion:
    def test_exige_los_siete_dias(self) -> None:
        with pytest.raises(InvalidSchedule):
            StoreSchedule().set_week(week()[:6])
        with pytest.raises(InvalidSchedule):
            StoreSchedule().set_week([*week()[:6], DayHours(0, True, time(8), time(20))])

    @pytest.mark.parametrize(
        ("opens", "closes"),
        [(time(20), time(8)), (time(8), time(8)), (None, time(8)), (time(8), None)],
    )
    def test_un_dia_abierto_necesita_apertura_menor_que_cierre(
        self, opens: time | None, closes: time | None
    ) -> None:
        days = week()
        days[2] = DayHours(2, True, opens, closes)

        with pytest.raises(InvalidSchedule):
            StoreSchedule().set_week(days)

    def test_un_dia_cerrado_ignora_sus_horas(self) -> None:
        s = StoreSchedule()
        days = week()
        days[3] = DayHours(3, False, time(20), time(8))  # horas absurdas, pero el día no abre

        s.set_week(days)

        assert s.days[3] == DayHours(3, False)

    def test_fecha_de_cierre_no_puede_ser_pasada_ni_tener_motivo_larguisimo(self) -> None:
        s = StoreSchedule()

        with pytest.raises(InvalidClosedDate):
            s.add_closed_date(MONDAY - timedelta(days=1), "", MONDAY)
        with pytest.raises(InvalidClosedDate):
            s.add_closed_date(MONDAY, "x" * 121, MONDAY)

    def test_repetir_una_fecha_cambia_el_motivo_y_se_puede_quitar(self) -> None:
        s = StoreSchedule()
        s.add_closed_date(MONDAY, "Vacaciones", MONDAY)
        s.add_closed_date(MONDAY, "  Feriado   local ", MONDAY)

        assert [(c.day, c.reason) for c in s.closed_dates] == [(MONDAY, "Feriado local")]
        s.remove_closed_date(MONDAY)
        assert s.closed_dates == []

    def test_las_fechas_quedan_ordenadas(self) -> None:
        s = StoreSchedule()
        for offset in (5, 1, 3):
            s.add_closed_date(MONDAY + timedelta(days=offset), "", MONDAY)

        assert [c.day for c in s.closed_dates] == [MONDAY + timedelta(days=d) for d in (1, 3, 5)]


class TestTiendaConHorario:
    def _store(self) -> Store:
        return Store.create(
            owner_user_id=uuid4(),
            name="La Esquina",
            category=StoreCategory.BAKERY,
            description="",
            lat=5.1667,
            lng=-75.5167,
            now=at(MONDAY, 6),
        )

    def test_el_interruptor_manual_cierra_aunque_el_horario_diga_abierto(self) -> None:
        store = self._store()
        store.schedule.set_week(week())
        store.set_open(False)

        assert store.closed_reason(at(MONDAY, 12)) == ClosedReason.MANUAL
        assert not store.is_open_now(at(MONDAY, 12))

    def test_con_el_interruptor_encendido_manda_el_horario(self) -> None:
        store = self._store()
        store.schedule.set_week(week())

        assert store.is_open_now(at(MONDAY, 12))
        assert not store.is_open_now(at(MONDAY, 22))

    def test_proxima_apertura_solo_si_esta_cerrada(self) -> None:
        store = self._store()
        store.schedule.set_week(week())

        assert store.next_open_at(at(MONDAY, 12)) is None
        assert store.next_open_at(at(MONDAY, 22)) == at(MONDAY + timedelta(days=1), 8)
