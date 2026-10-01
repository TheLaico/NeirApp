from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.wallet.domain.entities import EntryType, LedgerEntry
from neirapp.modules.wallet.infrastructure.models import LedgerEntryModel


def _to_entry(model: LedgerEntryModel) -> LedgerEntry:
    return LedgerEntry(
        id=model.id,
        courier_id=model.courier_id,
        type=EntryType(model.type),
        amount_cop=model.amount_cop,
        reason=model.reason,
        reference_id=model.reference_id,
        created_at=model.created_at,
    )


class SqlAlchemyLedgerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, entry: LedgerEntry) -> None:
        self._session.add(
            LedgerEntryModel(
                id=entry.id,
                courier_id=entry.courier_id,
                type=entry.type.value,
                amount_cop=entry.amount_cop,
                reason=entry.reason,
                reference_id=entry.reference_id,
                created_at=entry.created_at,
            )
        )
        await self._session.flush()

    async def list_by_courier(self, courier_id: UUID) -> list[LedgerEntry]:
        result = await self._session.execute(
            select(LedgerEntryModel)
            .where(LedgerEntryModel.courier_id == courier_id)
            .order_by(LedgerEntryModel.created_at.desc())
        )
        return [_to_entry(m) for m in result.scalars()]
