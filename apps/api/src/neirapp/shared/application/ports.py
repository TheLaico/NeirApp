from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    """Reloj inyectable para que el tiempo sea determinista en los tests."""

    def now(self) -> datetime:
        """Devuelve la hora actual en UTC (siempre con zona horaria)."""
        ...
