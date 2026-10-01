from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.leads.application.ports import LeadStore
from neirapp.modules.leads.domain.entities import MerchantLead
from neirapp.modules.leads.domain.errors import LeadNotFound
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class SubmitLeadCommand:
    contact_name: str
    business_name: str
    phone: str


class SubmitLead:
    """Registra la solicitud de un negocio que quiere vender en NeirApp."""

    def __init__(self, store: LeadStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    async def __call__(self, user_id: UUID, cmd: SubmitLeadCommand) -> MerchantLead:
        lead = MerchantLead.create(
            user_id=user_id,
            contact_name=cmd.contact_name,
            business_name=cmd.business_name,
            phone=cmd.phone,
            now=self._clock.now(),
        )
        await self._store.add(lead)
        return lead


class ListLeads:
    """Todas las solicitudes, las más recientes primero (para el administrador)."""

    def __init__(self, store: LeadStore) -> None:
        self._store = store

    async def __call__(self) -> list[MerchantLead]:
        return await self._store.list_all()


class SetLeadContacted:
    """Marca si un asesor ya se comunicó con el negocio."""

    def __init__(self, store: LeadStore) -> None:
        self._store = store

    async def __call__(self, lead_id: UUID, *, is_contacted: bool) -> MerchantLead:
        lead = await self._store.set_contacted(lead_id, is_contacted)
        if lead is None:
            raise LeadNotFound()
        return lead
