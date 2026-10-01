from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.modules.professionals.application.profiles import DirectoryFilter
from neirapp.modules.professionals.domain.categories import Category, Subcategory
from neirapp.modules.professionals.domain.entities import (
    MAX_DESCRIPTION,
    Modalities,
    ProfessionalProfile,
    ProfileData,
)
from neirapp.modules.professionals.presentation.dependencies import ProfessionalsDep

RequireProfessional = Annotated[User, Depends(require_roles(Role.PROFESSIONAL, Role.ADMIN))]
RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(prefix="/professionals", tags=["professionals"])


class ModalitiesBody(BaseModel):
    office: bool = True
    home: bool = False
    online: bool = False


class ProfileRequest(BaseModel):
    # Límites holgados: la validación de negocio (con mensajes claros) vive en el dominio.
    title: str = Field(default="", max_length=20)
    full_name: str = Field(max_length=200)
    headline: str = Field(default="", max_length=200)
    category_id: str = Field(max_length=100)
    subcategory_id: str = Field(default="", max_length=100)
    experience_years: int | None = None
    description: str = Field(default="", max_length=MAX_DESCRIPTION * 2)
    phone: str = Field(max_length=40)
    whatsapp: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=400)
    address: str = Field(default="", max_length=300)
    schedule: str = Field(default="", max_length=300)
    modalities: ModalitiesBody = Field(default_factory=ModalitiesBody)
    is_available: bool = True
    photo_url: str = Field(default="", max_length=400)

    def to_data(self) -> ProfileData:
        return ProfileData(
            title=self.title,
            full_name=self.full_name,
            headline=self.headline,
            category_id=self.category_id,
            subcategory_id=self.subcategory_id,
            experience_years=self.experience_years,
            description=self.description,
            phone=self.phone,
            whatsapp=self.whatsapp,
            email=self.email,
            address=self.address,
            schedule=self.schedule,
            modalities=Modalities(**self.modalities.model_dump()),
            is_available=self.is_available,
            photo_url=self.photo_url,
        )


class SetFeaturedRequest(BaseModel):
    is_featured: bool


class ProfileResponse(BaseModel):
    user_id: UUID
    title: str
    full_name: str
    display_name: str
    headline: str
    category_id: str
    subcategory_id: str
    experience_years: int | None
    description: str
    phone: str
    whatsapp: str
    email: str
    address: str
    schedule: str
    modalities: ModalitiesBody
    is_available: bool
    photo_url: str
    is_featured: bool
    updated_at: datetime

    @classmethod
    def from_domain(cls, p: ProfessionalProfile) -> "ProfileResponse":
        return cls(
            user_id=p.user_id,
            title=p.title,
            full_name=p.full_name,
            display_name=p.display_name,
            headline=p.headline,
            category_id=p.category_id,
            subcategory_id=p.subcategory_id,
            experience_years=p.experience_years,
            description=p.description,
            phone=p.phone,
            whatsapp=p.whatsapp,
            email=p.email,
            address=p.address,
            schedule=p.schedule,
            modalities=ModalitiesBody(
                office=p.modalities.office, home=p.modalities.home, online=p.modalities.online
            ),
            is_available=p.is_available,
            photo_url=p.photo_url,
            is_featured=p.is_featured,
            updated_at=p.updated_at,
        )


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(user: RequireProfessional, app: ProfessionalsDep) -> ProfileResponse:
    """El perfil del profesional que inició sesión (404 si todavía no lo ha creado)."""
    return ProfileResponse.from_domain(await app.get_my_profile(user.id))


@router.put("/me", response_model=ProfileResponse)
async def save_my_profile(
    body: ProfileRequest, user: RequireProfessional, app: ProfessionalsDep
) -> ProfileResponse:
    """Crea o actualiza el perfil. Se publica en el directorio mientras la cuenta tenga acceso."""
    return ProfileResponse.from_domain(await app.save_my_profile(user.id, body.to_data()))


@router.get("", response_model=list[ProfileResponse])
async def list_directory(
    app: ProfessionalsDep,
    category_id: Annotated[str | None, Query(max_length=100)] = None,
    subcategory_id: Annotated[str | None, Query(max_length=100)] = None,
) -> list[ProfileResponse]:
    """Directorio público: destacados primero, luego los disponibles."""
    profiles = await app.list_directory(
        DirectoryFilter(category_id=category_id, subcategory_id=subcategory_id)
    )
    return [ProfileResponse.from_domain(p) for p in profiles]


class SubcategoryResponse(BaseModel):
    id: str
    label: str
    color: str

    @classmethod
    def from_domain(cls, s: Subcategory) -> "SubcategoryResponse":
        return cls(id=s.id, label=s.label, color=s.color)


class CategoryResponse(BaseModel):
    id: str
    label: str
    icon: str
    color: str
    subcategories: list[SubcategoryResponse]

    @classmethod
    def from_domain(cls, c: Category) -> "CategoryResponse":
        return cls(
            id=c.id,
            label=c.label,
            icon=c.icon,
            color=c.color,
            subcategories=[SubcategoryResponse.from_domain(s) for s in c.subcategories],
        )


class CategoryRequest(BaseModel):
    label: str = Field(max_length=200)
    icon: str = Field(max_length=40)
    color: str = Field(max_length=20)


class SubcategoryRequest(BaseModel):
    label: str = Field(max_length=200)
    color: str = Field(max_length=20)


class ColorRequest(BaseModel):
    color: str = Field(max_length=20)


# Las rutas de categorías van antes de "/{user_id}" para que "categories" no se tome como un id.
@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(app: ProfessionalsDep) -> list[CategoryResponse]:
    """Áreas y especialidades del directorio, en el orden en que se crearon."""
    return [CategoryResponse.from_domain(c) for c in await app.list_categories()]


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    body: CategoryRequest, _admin: RequireAdmin, app: ProfessionalsDep
) -> CategoryResponse:
    category = await app.create_category(body.label, body.icon, body.color)
    return CategoryResponse.from_domain(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str, _admin: RequireAdmin, app: ProfessionalsDep
) -> Response:
    await app.delete_category(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/categories/{category_id}/subcategories", response_model=SubcategoryResponse, status_code=201
)
async def add_subcategory(
    category_id: str, body: SubcategoryRequest, _admin: RequireAdmin, app: ProfessionalsDep
) -> SubcategoryResponse:
    sub = await app.add_subcategory(category_id, body.label, body.color)
    return SubcategoryResponse.from_domain(sub)


@router.put(
    "/categories/{category_id}/subcategories/{subcategory_id}/color",
    response_model=SubcategoryResponse,
)
async def set_subcategory_color(
    category_id: str,
    subcategory_id: str,
    body: ColorRequest,
    _admin: RequireAdmin,
    app: ProfessionalsDep,
) -> SubcategoryResponse:
    sub = await app.set_subcategory_color(category_id, subcategory_id, body.color)
    return SubcategoryResponse.from_domain(sub)


@router.delete(
    "/categories/{category_id}/subcategories/{subcategory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_subcategory(
    category_id: str, subcategory_id: str, _admin: RequireAdmin, app: ProfessionalsDep
) -> Response:
    await app.delete_subcategory(category_id, subcategory_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_public_profile(user_id: UUID, app: ProfessionalsDep) -> ProfileResponse:
    return ProfileResponse.from_domain(await app.get_public_profile(user_id))


@router.put("/{user_id}/featured", response_model=ProfileResponse)
async def set_featured(
    user_id: UUID, body: SetFeaturedRequest, _admin: RequireAdmin, app: ProfessionalsDep
) -> ProfileResponse:
    profile = await app.set_featured(user_id, is_featured=body.is_featured)
    return ProfileResponse.from_domain(profile)
