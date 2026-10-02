from dataclasses import dataclass

from neirapp.modules.identity.application.dto import TermsPolicy
from neirapp.modules.identity.application.profile import (
    AcceptTerms,
    AuthenticateAccessToken,
    GetProfile,
    UpdateProfile,
)
from neirapp.modules.identity.application.registration import RegisterUser
from neirapp.modules.identity.application.role_grants import (
    FindUserByEmail,
    GrantRoleByEmail,
    ListRoleGrants,
    ListUserIdsWithRole,
    RevokeRoleGrant,
)
from neirapp.modules.identity.application.sessions import (
    ChangePassword,
    Login,
    Logout,
    RefreshSession,
)


@dataclass(frozen=True)
class IdentityApp:
    """Fachada del módulo: es lo único que la capa de presentación necesita conocer."""

    register: RegisterUser
    login: Login
    refresh: RefreshSession
    logout: Logout
    authenticate: AuthenticateAccessToken
    get_profile: GetProfile
    update_profile: UpdateProfile
    change_password: ChangePassword
    accept_terms: AcceptTerms
    terms_policy: TermsPolicy
    grant_role: GrantRoleByEmail
    revoke_role: RevokeRoleGrant
    list_role_grants: ListRoleGrants
    find_user_by_email: FindUserByEmail
    list_user_ids_with_role: ListUserIdsWithRole
