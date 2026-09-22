from dataclasses import dataclass

from neirapp.modules.identity.domain.entities import TermsDocument, User


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


@dataclass(frozen=True)
class ProfileView:
    user: User
    must_accept_terms: bool


@dataclass(frozen=True)
class AuthenticatedSession:
    profile: ProfileView
    tokens: TokenPair


@dataclass(frozen=True)
class TermsPolicy:
    """Versiones vigentes de los documentos legales que el usuario debe haber aceptado."""

    versions: dict[TermsDocument, str]
