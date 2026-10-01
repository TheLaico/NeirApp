from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from neirapp.modules.identity.application.dto import (
    AuthenticatedSession,
    ProfileView,
    TokenPair,
)
from neirapp.modules.identity.application.role_grants import RoleGrantView
from neirapp.modules.identity.domain.entities import Role, TermsDocument


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(description="Celular colombiano, con o sin +57. Ej: 300 123 4567")
    accepted_terms: bool = Field(
        description="El usuario acepta los términos y condiciones y la política de privacidad."
    )


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None


class AcceptTermsRequest(BaseModel):
    document: TermsDocument
    version: str


class TermsDocumentVersion(BaseModel):
    document: TermsDocument
    version: str


class TermsPolicyResponse(BaseModel):
    documents: list[TermsDocumentVersion]


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: str
    roles: list[Role]
    must_accept_terms: bool

    @classmethod
    def from_profile(cls, profile: ProfileView) -> "UserResponse":
        user = profile.user
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            roles=sorted(user.roles),
            must_accept_terms=profile.must_accept_terms,
        )


class TokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int = Field(description="Segundos de vida del access token.")

    @classmethod
    def from_pair(cls, pair: TokenPair) -> "TokensResponse":
        return cls(
            access_token=pair.access_token,
            refresh_token=pair.refresh_token,
            expires_in=pair.expires_in,
        )


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokensResponse

    @classmethod
    def from_session(cls, session: AuthenticatedSession) -> "AuthResponse":
        return cls(
            user=UserResponse.from_profile(session.profile),
            tokens=TokensResponse.from_pair(session.tokens),
        )


class RoleGrantRequest(BaseModel):
    email: str
    role: Role


class RoleGrantResponse(BaseModel):
    email: str
    role: Role
    created_at: datetime
    has_account: bool
    full_name: str | None

    @classmethod
    def from_view(cls, view: RoleGrantView) -> "RoleGrantResponse":
        return cls(
            email=view.grant.email,
            role=view.grant.role,
            created_at=view.grant.created_at,
            has_account=view.full_name is not None,
            full_name=view.full_name,
        )
