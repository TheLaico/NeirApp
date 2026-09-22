from uuid import UUID

from neirapp.modules.identity.application.dto import TermsPolicy
from neirapp.modules.identity.application.ports import UnitOfWork


async def has_accepted_current_terms(uow: UnitOfWork, user_id: UUID, policy: TermsPolicy) -> bool:
    for document, version in policy.versions.items():
        if not await uow.terms.has_accepted(user_id, document, version):
            return False
    return True
