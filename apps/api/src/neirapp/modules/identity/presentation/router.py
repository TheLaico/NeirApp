from fastapi import APIRouter, Response, status

from neirapp.modules.identity.application.registration import RegisterUserCommand
from neirapp.modules.identity.presentation.dependencies import (
    ClientIpDep,
    CurrentUser,
    IdentityDep,
)
from neirapp.modules.identity.presentation.schemas import (
    AcceptTermsRequest,
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TermsDocumentVersion,
    TermsPolicyResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/identity", tags=["identity"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, identity: IdentityDep, ip: ClientIpDep) -> AuthResponse:
    session = await identity.register(
        RegisterUserCommand(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            phone=body.phone,
            accepted_terms=body.accepted_terms,
            ip_address=ip,
        )
    )
    return AuthResponse.from_session(session)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, identity: IdentityDep) -> AuthResponse:
    return AuthResponse.from_session(await identity.login(body.email, body.password))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(body: RefreshRequest, identity: IdentityDep) -> AuthResponse:
    return AuthResponse.from_session(await identity.refresh(body.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, identity: IdentityDep) -> Response:
    await identity.logout(body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser, identity: IdentityDep) -> UserResponse:
    return UserResponse.from_profile(await identity.get_profile(user.id))


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest, user: CurrentUser, identity: IdentityDep
) -> UserResponse:
    profile = await identity.update_profile(user.id, full_name=body.full_name, phone=body.phone)
    return UserResponse.from_profile(profile)


@router.post("/terms/accept", response_model=UserResponse)
async def accept_terms(
    body: AcceptTermsRequest, user: CurrentUser, identity: IdentityDep, ip: ClientIpDep
) -> UserResponse:
    profile = await identity.accept_terms(user.id, body.document, body.version, ip)
    return UserResponse.from_profile(profile)


@router.get("/terms", response_model=TermsPolicyResponse)
async def current_terms(identity: IdentityDep) -> TermsPolicyResponse:
    """Versiones vigentes de los documentos legales (público)."""
    return TermsPolicyResponse(
        documents=[
            TermsDocumentVersion(document=doc, version=version)
            for doc, version in identity.terms_policy.versions.items()
        ]
    )
