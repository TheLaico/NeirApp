from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.wallet.domain.errors import InsufficientBalance, InvalidAmount

MAX_AMOUNT_COP = 50_000_000


class EntryType(StrEnum):
    CREDIT = "credit"  # gana el repartidor (una entrega completada)
    DEBIT = "debit"  # sale de su saldo (un retiro)


@dataclass(frozen=True)
class LedgerEntry:
    """El saldo de un repartidor nunca se guarda editable: siempre se calcula sumando estas
    filas (ver `compute_balance`). Así una fila mal escrita no puede "perder" plata sin dejar
    rastro — el histórico completo es la única fuente de verdad."""

    id: UUID
    courier_id: UUID
    type: EntryType
    amount_cop: int
    reason: str
    reference_id: UUID | None
    created_at: datetime

    @classmethod
    def credit(
        cls,
        *,
        courier_id: UUID,
        amount_cop: int,
        reason: str,
        reference_id: UUID | None,
        now: datetime,
    ) -> "LedgerEntry":
        _validate_amount(amount_cop)
        return cls(uuid4(), courier_id, EntryType.CREDIT, amount_cop, reason, reference_id, now)

    @classmethod
    def debit(
        cls,
        *,
        courier_id: UUID,
        amount_cop: int,
        reason: str,
        reference_id: UUID | None,
        now: datetime,
    ) -> "LedgerEntry":
        _validate_amount(amount_cop)
        return cls(uuid4(), courier_id, EntryType.DEBIT, amount_cop, reason, reference_id, now)

    @property
    def signed_amount_cop(self) -> int:
        return self.amount_cop if self.type == EntryType.CREDIT else -self.amount_cop


def _validate_amount(amount_cop: int) -> None:
    if not 0 < amount_cop <= MAX_AMOUNT_COP:
        raise InvalidAmount()


def compute_balance(entries: list[LedgerEntry]) -> int:
    return sum(e.signed_amount_cop for e in entries)


def build_withdrawal(
    *, courier_id: UUID, amount_cop: int, current_balance: int, now: datetime
) -> LedgerEntry:
    """Valida contra el saldo actual (ya calculado por el llamador) y arma el débito. No hay
    pasarela de retiro real todavía — el débito se aplica al instante, como `FakePaymentGateway`
    en `ordering` (ver docs/ARCHITECTURE.md)."""
    _validate_amount(amount_cop)
    if amount_cop > current_balance:
        raise InsufficientBalance()
    return LedgerEntry.debit(
        courier_id=courier_id,
        amount_cop=amount_cop,
        reason="withdrawal",
        reference_id=None,
        now=now,
    )
