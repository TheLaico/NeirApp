from uuid import UUID

from neirapp.modules.wallet.application.ports import UnitOfWorkFactory
from neirapp.modules.wallet.domain.entities import LedgerEntry, build_withdrawal, compute_balance
from neirapp.shared.application.ports import Clock


class CreditCourier:
    """Acredita el saldo de un repartidor. Lo llama `dispatch` (vía `WalletPort`) cuando se
    confirma una entrega — nunca se expone por HTTP: un cliente no puede acreditarse saldo solo."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(
        self, courier_id: UUID, amount_cop: int, *, reason: str, reference_id: UUID | None
    ) -> LedgerEntry:
        entry = LedgerEntry.credit(
            courier_id=courier_id,
            amount_cop=amount_cop,
            reason=reason,
            reference_id=reference_id,
            now=self._clock.now(),
        )
        async with self._uow_factory() as uow:
            await uow.ledger.add(entry)
            await uow.commit()
        return entry


class GetBalance:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, courier_id: UUID) -> int:
        async with self._uow_factory() as uow:
            entries = await uow.ledger.list_by_courier(courier_id)
        return compute_balance(entries)


class ListLedger:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, courier_id: UUID) -> list[LedgerEntry]:
        async with self._uow_factory() as uow:
            return await uow.ledger.list_by_courier(courier_id)


class RequestWithdrawal:
    """Retira saldo al instante (sin pasarela real de por medio, ver el docstring de
    `build_withdrawal`)."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, courier_id: UUID, amount_cop: int) -> LedgerEntry:
        async with self._uow_factory() as uow:
            entries = await uow.ledger.list_by_courier(courier_id)
            withdrawal = build_withdrawal(
                courier_id=courier_id,
                amount_cop=amount_cop,
                current_balance=compute_balance(entries),
                now=self._clock.now(),
            )
            await uow.ledger.add(withdrawal)
            await uow.commit()
        return withdrawal
