from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.wallet.domain.entities import EntryType, LedgerEntry


class RequestWithdrawalRequest(BaseModel):
    amount_cop: int = Field(gt=0, le=50_000_000)


class BalanceResponse(BaseModel):
    balance_cop: int


class LedgerEntryResponse(BaseModel):
    id: UUID
    type: EntryType
    amount_cop: int
    reason: str
    reference_id: UUID | None
    created_at: datetime

    @classmethod
    def from_domain(cls, entry: LedgerEntry) -> "LedgerEntryResponse":
        return cls(
            id=entry.id,
            type=entry.type,
            amount_cop=entry.amount_cop,
            reason=entry.reason,
            reference_id=entry.reference_id,
            created_at=entry.created_at,
        )
