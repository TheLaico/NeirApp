from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.modules.suppliers.application.use_cases import SupplierFilter
from neirapp.modules.suppliers.domain.entities import (
    MAX_DESCRIPTION,
    Supplier,
    SupplierCategory,
    SupplierData,
)
from neirapp.modules.suppliers.presentation.dependencies import SuppliersDep

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

RequireSupplier = Annotated[User, Depends(require_roles(Role.SUPPLIER, Role.ADMIN))]


class SupplierRequest(BaseModel):
    company_name: str = Field(max_length=200)
    category: SupplierCategory
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    phone: str = Field(max_length=30)
    tagline: str = Field(default="", max_length=200)
    whatsapp: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=320)
    address: str = Field(default="", max_length=240)
    website: str = Field(default="", max_length=300)
    facebook: str = Field(default="", max_length=300)
    instagram: str = Field(default="", max_length=300)
    logo_url: str = Field(default="", max_length=300)
    cover_url: str = Field(default="", max_length=300)
    catalog_url: str = Field(default="", max_length=300)
    is_listed: bool = True

    def to_data(self) -> SupplierData:
        return SupplierData(**self.model_dump())


class SupplierResponse(BaseModel):
    user_id: UUID
    company_name: str
    tagline: str
    category: SupplierCategory
    description: str
    phone: str
    whatsapp: str
    email: str
    address: str
    website: str
    facebook: str
    instagram: str
    logo_url: str
    cover_url: str
    catalog_url: str
    is_listed: bool
    updated_at: datetime

    @classmethod
    def from_domain(cls, s: Supplier) -> "SupplierResponse":
        return cls(
            user_id=s.user_id,
            company_name=s.company_name,
            tagline=s.tagline,
            category=s.category,
            description=s.description,
            phone=s.phone,
            whatsapp=s.whatsapp,
            email=s.email,
            address=s.address,
            website=s.website,
            facebook=s.facebook,
            instagram=s.instagram,
            logo_url=s.logo_url,
            cover_url=s.cover_url,
            catalog_url=s.catalog_url,
            is_listed=s.is_listed,
            updated_at=s.updated_at,
        )


@router.get("/me", response_model=SupplierResponse)
async def get_my_supplier(user: RequireSupplier, app: SuppliersDep) -> SupplierResponse:
    """El perfil de la empresa que inició sesión (404 si todavía no lo ha creado)."""
    return SupplierResponse.from_domain(await app.get_my_supplier(user.id))


@router.put("/me", response_model=SupplierResponse)
async def save_my_supplier(
    body: SupplierRequest, user: RequireSupplier, app: SuppliersDep
) -> SupplierResponse:
    """Crea o actualiza el perfil. Se publica mientras la cuenta tenga acceso de proveedor."""
    return SupplierResponse.from_domain(await app.save_my_supplier(user.id, body.to_data()))


@router.get("", response_model=list[SupplierResponse])
async def list_suppliers(
    app: SuppliersDep, category: Annotated[SupplierCategory | None, Query()] = None
) -> list[SupplierResponse]:
    """Directorio público de proveedores, los actualizados más recientemente primero."""
    suppliers = await app.list_suppliers(SupplierFilter(category=category))
    return [SupplierResponse.from_domain(s) for s in suppliers]


@router.get("/{user_id}", response_model=SupplierResponse)
async def get_supplier(user_id: UUID, app: SuppliersDep) -> SupplierResponse:
    return SupplierResponse.from_domain(await app.get_supplier(user_id))
