from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.leads.application.leads import SubmitLeadCommand
from neirapp.modules.leads.domain.entities import MAX_NAME_LENGTH, MerchantLead
from neirapp.modules.leads.presentation.dependencies import LeadsDep

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(tags=["leads"])


class SubmitLeadRequest(BaseModel):
    contact_name: str = Field(max_length=MAX_NAME_LENGTH * 2)
    business_name: str = Field(max_length=MAX_NAME_LENGTH * 2)
    phone: str = Field(max_length=64)


class SetContactedRequest(BaseModel):
    is_contacted: bool


class LeadResponse(BaseModel):
    id: UUID
    contact_name: str
    business_name: str
    phone: str
    is_contacted: bool
    created_at: datetime

    @classmethod
    def from_domain(cls, lead: MerchantLead) -> "LeadResponse":
        return cls(
            id=lead.id,
            contact_name=lead.contact_name,
            business_name=lead.business_name,
            phone=lead.phone,
            is_contacted=lead.is_contacted,
            created_at=lead.created_at,
        )


@router.post("/leads/merchants", response_model=LeadResponse, status_code=201)
async def submit_merchant_lead(
    body: SubmitLeadRequest, user: CurrentUser, leads: LeadsDep
) -> LeadResponse:
    """Un negocio deja sus datos para que un asesor de NeirApp lo contacte."""
    lead = await leads.submit_lead(
        user.id,
        SubmitLeadCommand(
            contact_name=body.contact_name, business_name=body.business_name, phone=body.phone
        ),
    )
    return LeadResponse.from_domain(lead)


@router.get("/leads/merchants", response_model=list[LeadResponse])
async def list_merchant_leads(_admin: RequireAdmin, leads: LeadsDep) -> list[LeadResponse]:
    return [LeadResponse.from_domain(lead) for lead in await leads.list_leads()]


@router.patch("/leads/merchants/{lead_id}", response_model=LeadResponse)
async def set_merchant_lead_contacted(
    lead_id: UUID, body: SetContactedRequest, _admin: RequireAdmin, leads: LeadsDep
) -> LeadResponse:
    lead = await leads.set_lead_contacted(lead_id, is_contacted=body.is_contacted)
    return LeadResponse.from_domain(lead)
