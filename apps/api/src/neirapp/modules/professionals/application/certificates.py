from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.professionals.application.ports import (
    AccessPort,
    CertificateRepository,
    ProfileRepository,
)
from neirapp.modules.professionals.domain.certificates import (
    MAX_CERTIFICATES,
    Certificate,
    CertificateData,
)
from neirapp.modules.professionals.domain.errors import (
    CertificateNotFound,
    ProfileNotFound,
    TooManyCertificates,
)
from neirapp.shared.application.ports import Clock


async def _own(repo: CertificateRepository, user_id: UUID, certificate_id: UUID) -> Certificate:
    # Un certificado de otro profesional se trata como inexistente: no se revela que existe.
    certificate = await repo.get(certificate_id)
    if certificate is None or certificate.user_id != user_id:
        raise CertificateNotFound()
    return certificate


class ListMyCertificates:
    def __init__(self, repo: CertificateRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> list[Certificate]:
        return await self._repo.list_for(user_id)


class AddCertificate:
    """Agrega un certificado; queda en revisión hasta que el admin lo apruebe."""

    def __init__(self, repo: CertificateRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, data: CertificateData) -> Certificate:
        if len(await self._repo.list_for(user_id)) >= MAX_CERTIFICATES:
            raise TooManyCertificates()
        certificate = Certificate.create(user_id, data, self._clock.now())
        await self._repo.save(certificate)
        return certificate


class UpdateCertificate:
    def __init__(self, repo: CertificateRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(
        self, user_id: UUID, certificate_id: UUID, data: CertificateData
    ) -> Certificate:
        certificate = await _own(self._repo, user_id, certificate_id)
        certificate.update(data, self._clock.now())
        await self._repo.save(certificate)
        return certificate


class DeleteCertificate:
    def __init__(self, repo: CertificateRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, certificate_id: UUID) -> None:
        await _own(self._repo, user_id, certificate_id)
        await self._repo.delete(certificate_id)


@dataclass(frozen=True)
class PendingCertificate:
    certificate: Certificate
    # Nombre del profesional como aparece en su perfil ("" si todavía no lo creó).
    professional_name: str


class ListPendingCertificates:
    """Para el admin: lo que falta por revisar, con el nombre de quién lo subió."""

    def __init__(self, repo: CertificateRepository, profiles: ProfileRepository) -> None:
        self._repo = repo
        self._profiles = profiles

    async def __call__(self) -> list[PendingCertificate]:
        names = {p.user_id: p.display_name for p in await self._profiles.list_all()}
        return [
            PendingCertificate(c, names.get(c.user_id, "")) for c in await self._repo.list_pending()
        ]


class ReviewCertificate:
    def __init__(self, repo: CertificateRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, certificate_id: UUID, *, approve: bool, note: str) -> Certificate:
        certificate = await self._repo.get(certificate_id)
        if certificate is None:
            raise CertificateNotFound()
        certificate.review(approve=approve, note=note, now=self._clock.now())
        await self._repo.save(certificate)
        return certificate


class ListPublicCertificates:
    """Verificados y que el profesional decidió mostrar (para su página "Ver perfil")."""

    def __init__(self, repo: CertificateRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, user_id: UUID) -> list[Certificate]:
        if user_id not in await self._access.professional_ids():
            raise ProfileNotFound("Perfil no encontrado.")
        return [c for c in await self._repo.list_for(user_id) if c.is_public]
