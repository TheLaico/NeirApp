from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from neirapp.modules.leads.domain.errors import (
    InvalidBusinessName,
    InvalidContactName,
    InvalidContactPhone,
)

MAX_NAME_LENGTH = 80


def _clean(text: str) -> str:
    return " ".join(text.split())


@dataclass
class MerchantLead:
    """Un negocio que dejó sus datos para que un asesor de NeirApp lo contacte."""

    id: UUID
    user_id: UUID
    contact_name: str
    business_name: str
    phone: str
    created_at: datetime
    is_contacted: bool = False

    @classmethod
    def create(
        cls,
        *,
        user_id: UUID,
        contact_name: str,
        business_name: str,
        phone: str,
        now: datetime,
    ) -> "MerchantLead":
        contact_name = _clean(contact_name)
        business_name = _clean(business_name)
        if not 2 <= len(contact_name) <= MAX_NAME_LENGTH:
            raise InvalidContactName()
        if not 2 <= len(business_name) <= MAX_NAME_LENGTH:
            raise InvalidBusinessName()
        digits = "".join(ch for ch in phone if ch.isdigit())
        if not 7 <= len(digits) <= 15:
            raise InvalidContactPhone()
        return cls(
            id=uuid4(),
            user_id=user_id,
            contact_name=contact_name,
            business_name=business_name,
            phone=_clean(phone)[:32],
            created_at=now,
        )
