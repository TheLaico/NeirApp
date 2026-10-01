from datetime import UTC, datetime
from uuid import uuid4

import pytest

from neirapp.modules.wallet.domain.entities import (
    EntryType,
    LedgerEntry,
    build_withdrawal,
    compute_balance,
)
from neirapp.modules.wallet.domain.errors import InsufficientBalance, InvalidAmount

NOW = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)


class TestLedgerEntry:
    def test_credit_tiene_signo_positivo(self) -> None:
        entry = LedgerEntry.credit(
            courier_id=uuid4(),
            amount_cop=6_000,
            reason="delivery_completed",
            reference_id=None,
            now=NOW,
        )
        assert entry.type == EntryType.CREDIT
        assert entry.signed_amount_cop == 6_000

    def test_debit_tiene_signo_negativo(self) -> None:
        entry = LedgerEntry.debit(
            courier_id=uuid4(), amount_cop=6_000, reason="withdrawal", reference_id=None, now=NOW
        )
        assert entry.type == EntryType.DEBIT
        assert entry.signed_amount_cop == -6_000

    @pytest.mark.parametrize("amount", [0, -1, 50_000_001])
    def test_monto_invalido_falla(self, amount: int) -> None:
        with pytest.raises(InvalidAmount):
            LedgerEntry.credit(
                courier_id=uuid4(), amount_cop=amount, reason="x", reference_id=None, now=NOW
            )


class TestComputeBalance:
    def test_saldo_vacio_es_cero(self) -> None:
        assert compute_balance([]) == 0

    def test_suma_creditos_y_restas_debitos(self) -> None:
        courier_id = uuid4()
        entries = [
            LedgerEntry.credit(
                courier_id=courier_id, amount_cop=10_000, reason="a", reference_id=None, now=NOW
            ),
            LedgerEntry.credit(
                courier_id=courier_id, amount_cop=5_000, reason="b", reference_id=None, now=NOW
            ),
            LedgerEntry.debit(
                courier_id=courier_id,
                amount_cop=4_000,
                reason="withdrawal",
                reference_id=None,
                now=NOW,
            ),
        ]
        assert compute_balance(entries) == 11_000


class TestBuildWithdrawal:
    def test_retiro_valido(self) -> None:
        withdrawal = build_withdrawal(
            courier_id=uuid4(), amount_cop=5_000, current_balance=10_000, now=NOW
        )
        assert withdrawal.type == EntryType.DEBIT
        assert withdrawal.amount_cop == 5_000
        assert withdrawal.reason == "withdrawal"

    def test_no_se_puede_retirar_mas_del_saldo(self) -> None:
        with pytest.raises(InsufficientBalance):
            build_withdrawal(courier_id=uuid4(), amount_cop=10_001, current_balance=10_000, now=NOW)

    def test_retiro_del_saldo_exacto(self) -> None:
        withdrawal = build_withdrawal(
            courier_id=uuid4(), amount_cop=10_000, current_balance=10_000, now=NOW
        )
        assert withdrawal.amount_cop == 10_000

    def test_monto_invalido_falla(self) -> None:
        with pytest.raises(InvalidAmount):
            build_withdrawal(courier_id=uuid4(), amount_cop=0, current_balance=10_000, now=NOW)
