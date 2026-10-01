"""Horario de atención de una tienda: horas por día de la semana y fechas en que no abre.

Todo se interpreta en hora de Colombia (UTC-5, sin horario de verano): así "abre a las 8:00"
significa lo mismo para el comerciante, el cliente y el servidor, corra donde corra.

Una tienda sin horario (`days` vacío) no tiene restricciones: solo depende de su interruptor manual.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from enum import StrEnum

from neirapp.modules.stores.domain.errors import InvalidClosedDate, InvalidSchedule

COLOMBIA = timezone(timedelta(hours=-5))
MAX_REASON_LENGTH = 120
MAX_CLOSED_DATES = 366


class ClosedReason(StrEnum):
    """Por qué una tienda está cerrada en un momento dado."""

    MANUAL = "manual"  # el comerciante apagó el interruptor
    CLOSED_DATE = "closed_date"  # hoy es una fecha en que avisó que no abre
    DAY_OFF = "day_off"  # hoy no abre por su horario semanal
    OUTSIDE_HOURS = "outside_hours"  # hoy abre, pero ahora está fuera de su horario


@dataclass(frozen=True)
class DayHours:
    weekday: int  # 0 = lunes … 6 = domingo (igual que `datetime.weekday()`)
    is_open: bool
    opens: time | None = None
    closes: time | None = None
    # Abierto las 24 horas de ese día (no existe la hora 24:00, así que no se expresa con `closes`).
    all_day: bool = False


@dataclass(frozen=True)
class ClosedDate:
    day: date
    reason: str = ""


def local_time(now: datetime) -> datetime:
    """La hora `now` (UTC) en Colombia."""
    return now.astimezone(COLOMBIA)


@dataclass
class StoreSchedule:
    days: list[DayHours] = field(default_factory=list)  # vacío = sin horario
    closed_dates: list[ClosedDate] = field(default_factory=list)

    @property
    def has_hours(self) -> bool:
        return bool(self.days)

    def set_week(self, days: list[DayHours]) -> None:
        """Reemplaza el horario semanal: exige los 7 días y, si abre, apertura < cierre (o 24 h)."""
        if sorted(d.weekday for d in days) != list(range(7)):
            raise InvalidSchedule()
        clean: list[DayHours] = []
        for d in days:
            if not d.is_open:
                clean.append(DayHours(d.weekday, False))
            elif d.all_day:
                clean.append(DayHours(d.weekday, True, all_day=True))
            elif d.opens is None or d.closes is None or d.opens >= d.closes:
                raise InvalidSchedule()
            else:
                clean.append(DayHours(d.weekday, True, d.opens, d.closes))
        self.days = sorted(clean, key=lambda d: d.weekday)

    @property
    def is_24_7(self) -> bool:
        """¿Abre todos los días, las 24 horas?"""
        return len(self.days) == 7 and all(d.is_open and d.all_day for d in self.days)

    def clear_week(self) -> None:
        self.days = []

    def add_closed_date(self, day: date, reason: str, today: date) -> None:
        """Marca una fecha (de hoy en adelante) en que no abre. Repetirla cambia el motivo."""
        reason = " ".join(reason.split())
        if day < today or len(reason) > MAX_REASON_LENGTH:
            raise InvalidClosedDate()
        others = [c for c in self.closed_dates if c.day != day]
        if len(others) >= MAX_CLOSED_DATES:
            raise InvalidClosedDate()
        self.closed_dates = sorted([*others, ClosedDate(day, reason)], key=lambda c: c.day)

    def remove_closed_date(self, day: date) -> None:
        self.closed_dates = [c for c in self.closed_dates if c.day != day]

    def _hours_for(self, day: date) -> DayHours | None:
        return next((d for d in self.days if d.weekday == day.weekday()), None)

    def _is_closed_date(self, day: date) -> bool:
        return any(c.day == day for c in self.closed_dates)

    def closed_reason_at(self, now: datetime) -> ClosedReason | None:
        """`None` si el horario deja la tienda abierta en `now`; si no, el motivo del cierre."""
        local = local_time(now)
        if self._is_closed_date(local.date()):
            return ClosedReason.CLOSED_DATE
        if not self.has_hours:
            return None
        hours = self._hours_for(local.date())
        if hours is None or not hours.is_open:
            return ClosedReason.DAY_OFF
        if hours.all_day:
            return None
        assert hours.opens is not None and hours.closes is not None
        if hours.opens <= local.time().replace(tzinfo=None) < hours.closes:
            return None
        return ClosedReason.OUTSIDE_HOURS

    def next_open_after(self, now: datetime) -> datetime | None:
        """La próxima apertura según el horario (hora de Colombia), o `None` si no hay horario o
        no abre en 14 días. Considera los días libres y las fechas de cierre."""
        if not self.has_hours:
            return None
        local = local_time(now)
        for offset in range(15):
            day = local.date() + timedelta(days=offset)
            hours = self._hours_for(day)
            if self._is_closed_date(day) or hours is None or not hours.is_open:
                continue
            opens_at = datetime.combine(day, hours.opens or time(0, 0), tzinfo=COLOMBIA)
            if opens_at > local:
                return opens_at
        return None
