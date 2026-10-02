from dataclasses import dataclass, field
from uuid import UUID

from neirapp.modules.leads.application.ports import ApplicationStore
from neirapp.modules.leads.domain.applications import RoleApplication
from neirapp.modules.leads.domain.errors import LeadNotFound
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class SubmitApplicationCommand:
    role: str
    full_name: str
    document_number: str
    phone: str
    email: str
    company_name: str = ""
    company_id: str = ""
    details: dict[str, str] = field(default_factory=dict)
    message: str = ""


class SubmitApplication:
    """Alguien pide formar parte de NeirAPP con un rol (no hace falta tener cuenta)."""

    def __init__(self, store: ApplicationStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    async def __call__(self, cmd: SubmitApplicationCommand) -> RoleApplication:
        application = RoleApplication.create(
            role=cmd.role,
            full_name=cmd.full_name,
            document_number=cmd.document_number,
            phone=cmd.phone,
            email=cmd.email,
            company_name=cmd.company_name,
            company_id=cmd.company_id,
            details=cmd.details,
            message=cmd.message,
            now=self._clock.now(),
        )
        await self._store.add(application)
        return application


class ListApplications:
    """Todas las solicitudes de rol, las más recientes primero (para el administrador)."""

    def __init__(self, store: ApplicationStore) -> None:
        self._store = store

    async def __call__(self) -> list[RoleApplication]:
        return await self._store.list_all()


class SetApplicationContacted:
    def __init__(self, store: ApplicationStore) -> None:
        self._store = store

    async def __call__(self, application_id: UUID, *, is_contacted: bool) -> RoleApplication:
        application = await self._store.set_contacted(application_id, is_contacted)
        if application is None:
            raise LeadNotFound()
        return application
