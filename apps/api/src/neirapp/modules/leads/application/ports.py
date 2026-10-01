from typing import Protocol
from uuid import UUID

from neirapp.modules.leads.domain.entities import MerchantLead


class LeadStore(Protocol):
    async def add(self, lead: MerchantLead) -> None: ...

    async def list_all(self) -> list[MerchantLead]: ...

    async def set_contacted(self, lead_id: UUID, is_contacted: bool) -> MerchantLead | None: ...
