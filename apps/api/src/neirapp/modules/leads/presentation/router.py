from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.leads.application.applications import SubmitApplicationCommand
from neirapp.modules.leads.application.leads import SubmitLeadCommand
from neirapp.modules.leads.domain.applications import RoleApplication
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


# --- "¿Quieres formar parte de NeirAPP?" -------------------------------------------------------
# Pública (se envía desde la pantalla de inicio de sesión, sin cuenta). `website` es una trampa
# para bots: el formulario la deja vacía y oculta, así que si llega con algo se responde como si
# se hubiera guardado, pero no se guarda.


class SubmitApplicationRequest(BaseModel):
    role: str = Field(max_length=20)
    full_name: str = Field(max_length=200)
    document_number: str = Field(max_length=40)
    phone: str = Field(max_length=64)
    email: str = Field(max_length=254)
    company_name: str = Field(default="", max_length=240)
    company_id: str = Field(default="", max_length=80)
    details: dict[str, str] = Field(default_factory=dict, max_length=20)
    message: str = Field(default="", max_length=1200)
    website: str = Field(default="", max_length=200)


class ApplicationResponse(BaseModel):
    id: UUID
    role: str
    full_name: str
    document_number: str
    phone: str
    email: str
    company_name: str
    company_id: str
    details: dict[str, str]
    message: str
    is_contacted: bool
    created_at: datetime

    @classmethod
    def from_domain(cls, a: RoleApplication) -> "ApplicationResponse":
        return cls(
            id=a.id,
            role=a.role,
            full_name=a.full_name,
            document_number=a.document_number,
            phone=a.phone,
            email=a.email,
            company_name=a.company_name,
            company_id=a.company_id,
            details=a.details,
            message=a.message,
            is_contacted=a.is_contacted,
            created_at=a.created_at,
        )


class ApplicationReceived(BaseModel):
    ok: bool = True


@router.post("/leads/applications", response_model=ApplicationReceived, status_code=201)
async def submit_role_application(
    body: SubmitApplicationRequest, leads: LeadsDep
) -> ApplicationReceived:
    """Alguien pide formar parte de NeirAPP con un rol. No devuelve los datos: es pública."""
    if body.website:
        return ApplicationReceived()
    await leads.submit_application(
        SubmitApplicationCommand(
            role=body.role,
            full_name=body.full_name,
            document_number=body.document_number,
            phone=body.phone,
            email=body.email,
            company_name=body.company_name,
            company_id=body.company_id,
            details=body.details,
            message=body.message,
        )
    )
    return ApplicationReceived()


@router.get("/leads/applications", response_model=list[ApplicationResponse])
async def list_role_applications(
    _admin: RequireAdmin, leads: LeadsDep
) -> list[ApplicationResponse]:
    return [ApplicationResponse.from_domain(a) for a in await leads.list_applications()]


@router.patch("/leads/applications/{application_id}", response_model=ApplicationResponse)
async def set_role_application_contacted(
    application_id: UUID, body: SetContactedRequest, _admin: RequireAdmin, leads: LeadsDep
) -> ApplicationResponse:
    application = await leads.set_application_contacted(
        application_id, is_contacted=body.is_contacted
    )
    return ApplicationResponse.from_domain(application)
