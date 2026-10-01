from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.modules.professionals.application.certificates import PendingCertificate
from neirapp.modules.professionals.application.profiles import DirectoryFilter
from neirapp.modules.professionals.domain.categories import Category, Subcategory
from neirapp.modules.professionals.domain.certificates import (
    MAX_ISSUER,
    MAX_TITLE,
    Certificate,
    CertificateData,
    CertificateKind,
    CertificateStatus,
)
from neirapp.modules.professionals.domain.entities import (
    MAX_DESCRIPTION,
    Modalities,
    ProfessionalProfile,
    ProfileData,
)
from neirapp.modules.professionals.domain.gallery import MAX_CAPTION, MAX_IMAGES, GalleryImage
from neirapp.modules.professionals.domain.services import (
    MAX_SERVICE_DESCRIPTION,
    PriceKind,
    ProfessionalService,
    ServiceData,
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


class ServiceRequest(BaseModel):
    name: str = Field(max_length=200)
    description: str = Field(default="", max_length=MAX_SERVICE_DESCRIPTION * 2)
    price_kind: PriceKind = PriceKind.QUOTE
    price_cop: int | None = None
    duration_minutes: int | None = None
    is_active: bool = True

    def to_data(self) -> ServiceData:
        return ServiceData(
            name=self.name,
            description=self.description,
            price_kind=self.price_kind,
            price_cop=self.price_cop,
            duration_minutes=self.duration_minutes,
            is_active=self.is_active,
        )


class ServiceResponse(BaseModel):
    id: UUID
    name: str
    description: str
    price_kind: PriceKind
    price_cop: int | None
    duration_minutes: int | None
    is_active: bool

    @classmethod
    def from_domain(cls, s: ProfessionalService) -> "ServiceResponse":
        return cls(
            id=s.id,
            name=s.name,
            description=s.description,
            price_kind=s.price_kind,
            price_cop=s.price_cop,
            duration_minutes=s.duration_minutes,
            is_active=s.is_active,
        )


@router.get("/me/services", response_model=list[ServiceResponse])
async def list_my_services(
    user: RequireProfessional, app: ProfessionalsDep
) -> list[ServiceResponse]:
    """Todos los servicios del profesional, también los ocultos."""
    return [ServiceResponse.from_domain(s) for s in await app.list_my_services(user.id)]


@router.post("/me/services", response_model=ServiceResponse, status_code=201)
async def add_service(
    body: ServiceRequest, user: RequireProfessional, app: ProfessionalsDep
) -> ServiceResponse:
    return ServiceResponse.from_domain(await app.add_service(user.id, body.to_data()))


@router.put("/me/services/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: UUID, body: ServiceRequest, user: RequireProfessional, app: ProfessionalsDep
) -> ServiceResponse:
    service = await app.update_service(user.id, service_id, body.to_data())
    return ServiceResponse.from_domain(service)


@router.delete("/me/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: UUID, user: RequireProfessional, app: ProfessionalsDep
) -> Response:
    await app.delete_service(user.id, service_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class GalleryImageRequest(BaseModel):
    url: str = Field(max_length=400)
    caption: str = Field(default="", max_length=MAX_CAPTION * 2)


class CaptionRequest(BaseModel):
    caption: str = Field(max_length=MAX_CAPTION * 2)


class GalleryOrderRequest(BaseModel):
    ids: list[UUID] = Field(max_length=MAX_IMAGES)


class GalleryImageResponse(BaseModel):
    id: UUID
    url: str
    caption: str

    @classmethod
    def from_domain(cls, i: GalleryImage) -> "GalleryImageResponse":
        return cls(id=i.id, url=i.url, caption=i.caption)


@router.get("/me/gallery", response_model=list[GalleryImageResponse])
async def list_my_gallery(
    user: RequireProfessional, app: ProfessionalsDep
) -> list[GalleryImageResponse]:
    return [GalleryImageResponse.from_domain(i) for i in await app.list_my_gallery(user.id)]


@router.post("/me/gallery", response_model=GalleryImageResponse, status_code=201)
async def add_gallery_image(
    body: GalleryImageRequest, user: RequireProfessional, app: ProfessionalsDep
) -> GalleryImageResponse:
    """Agrega una foto ya subida con `POST /uploads/images` (se manda la URL que devolvió)."""
    image = await app.add_gallery_image(user.id, body.url, body.caption)
    return GalleryImageResponse.from_domain(image)


# Antes que "/me/gallery/{image_id}" para que "order" no se tome como un id.
@router.put("/me/gallery/order", response_model=list[GalleryImageResponse])
async def reorder_gallery(
    body: GalleryOrderRequest, user: RequireProfessional, app: ProfessionalsDep
) -> list[GalleryImageResponse]:
    """Cambia el orden: se mandan todos los ids, el primero queda como portada."""
    images = await app.reorder_gallery(user.id, body.ids)
    return [GalleryImageResponse.from_domain(i) for i in images]


@router.patch("/me/gallery/{image_id}", response_model=GalleryImageResponse)
async def set_gallery_caption(
    image_id: UUID, body: CaptionRequest, user: RequireProfessional, app: ProfessionalsDep
) -> GalleryImageResponse:
    image = await app.set_gallery_caption(user.id, image_id, body.caption)
    return GalleryImageResponse.from_domain(image)


@router.delete("/me/gallery/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery_image(
    image_id: UUID, user: RequireProfessional, app: ProfessionalsDep
) -> Response:
    await app.delete_gallery_image(user.id, image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class CertificateRequest(BaseModel):
    kind: CertificateKind
    title: str = Field(max_length=MAX_TITLE * 2)
    issuer: str = Field(default="", max_length=MAX_ISSUER * 2)
    year: int | None = None
    file_url: str = Field(max_length=400)
    show_on_profile: bool = True

    def to_data(self) -> CertificateData:
        return CertificateData(
            kind=self.kind,
            title=self.title,
            issuer=self.issuer,
            year=self.year,
            file_url=self.file_url,
            show_on_profile=self.show_on_profile,
        )


class ReviewRequest(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=400)


class CertificateResponse(BaseModel):
    id: UUID
    kind: CertificateKind
    title: str
    issuer: str
    year: int | None
    file_url: str
    show_on_profile: bool
    status: CertificateStatus
    review_note: str
    updated_at: datetime

    @classmethod
    def from_domain(cls, c: Certificate) -> "CertificateResponse":
        return cls(
            id=c.id,
            kind=c.kind,
            title=c.title,
            issuer=c.issuer,
            year=c.year,
            file_url=c.file_url,
            show_on_profile=c.show_on_profile,
            status=c.status,
            review_note=c.review_note,
            updated_at=c.updated_at,
        )


class PublicCertificateResponse(BaseModel):
    """Lo que ven los clientes: sin notas de revisión ni estado (solo salen los verificados)."""

    id: UUID
    kind: CertificateKind
    title: str
    issuer: str
    year: int | None
    file_url: str

    @classmethod
    def from_domain(cls, c: Certificate) -> "PublicCertificateResponse":
        return cls(
            id=c.id, kind=c.kind, title=c.title, issuer=c.issuer, year=c.year, file_url=c.file_url
        )


class PendingCertificateResponse(CertificateResponse):
    user_id: UUID
    professional_name: str

    @classmethod
    def from_pending(cls, p: PendingCertificate) -> "PendingCertificateResponse":
        base = CertificateResponse.from_domain(p.certificate)
        return cls(
            **base.model_dump(),
            user_id=p.certificate.user_id,
            professional_name=p.professional_name,
        )


@router.get("/me/certificates", response_model=list[CertificateResponse])
async def list_my_certificates(
    user: RequireProfessional, app: ProfessionalsDep
) -> list[CertificateResponse]:
    return [CertificateResponse.from_domain(c) for c in await app.list_my_certificates(user.id)]


@router.post("/me/certificates", response_model=CertificateResponse, status_code=201)
async def add_certificate(
    body: CertificateRequest, user: RequireProfessional, app: ProfessionalsDep
) -> CertificateResponse:
    """Agrega un certificado (el archivo se sube antes a /uploads/documents o /uploads/images)."""
    return CertificateResponse.from_domain(await app.add_certificate(user.id, body.to_data()))


@router.put("/me/certificates/{certificate_id}", response_model=CertificateResponse)
async def update_certificate(
    certificate_id: UUID, body: CertificateRequest, user: RequireProfessional, app: ProfessionalsDep
) -> CertificateResponse:
    certificate = await app.update_certificate(user.id, certificate_id, body.to_data())
    return CertificateResponse.from_domain(certificate)


@router.delete("/me/certificates/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certificate(
    certificate_id: UUID, user: RequireProfessional, app: ProfessionalsDep
) -> Response:
    await app.delete_certificate(user.id, certificate_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Antes que "/{user_id}" para que "certificates" no se tome como un id.
@router.get("/certificates/pending", response_model=list[PendingCertificateResponse])
async def list_pending_certificates(
    _admin: RequireAdmin, app: ProfessionalsDep
) -> list[PendingCertificateResponse]:
    """Certificados por revisar, los más antiguos primero (solo admin)."""
    return [
        PendingCertificateResponse.from_pending(p) for p in await app.list_pending_certificates()
    ]


@router.put("/certificates/{certificate_id}/review", response_model=CertificateResponse)
async def review_certificate(
    certificate_id: UUID, body: ReviewRequest, _admin: RequireAdmin, app: ProfessionalsDep
) -> CertificateResponse:
    """Aprueba o rechaza (con el motivo) un certificado (solo admin)."""
    certificate = await app.review_certificate(certificate_id, approve=body.approve, note=body.note)
    return CertificateResponse.from_domain(certificate)


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


@router.get("/{user_id}/services", response_model=list[ServiceResponse])
async def list_public_services(user_id: UUID, app: ProfessionalsDep) -> list[ServiceResponse]:
    """Servicios visibles de un profesional (para su página de perfil)."""
    return [ServiceResponse.from_domain(s) for s in await app.list_public_services(user_id)]


@router.get("/{user_id}/gallery", response_model=list[GalleryImageResponse])
async def list_public_gallery(user_id: UUID, app: ProfessionalsDep) -> list[GalleryImageResponse]:
    """Galería de un profesional (para su página de perfil)."""
    return [GalleryImageResponse.from_domain(i) for i in await app.list_public_gallery(user_id)]


@router.get("/{user_id}/certificates", response_model=list[PublicCertificateResponse])
async def list_public_certificates(
    user_id: UUID, app: ProfessionalsDep
) -> list[PublicCertificateResponse]:
    """Certificados verificados que el profesional muestra en su perfil."""
    return [
        PublicCertificateResponse.from_domain(c)
        for c in await app.list_public_certificates(user_id)
    ]
