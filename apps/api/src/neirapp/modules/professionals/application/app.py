from dataclasses import dataclass

from neirapp.modules.professionals.application.profiles import (
    GetMyProfile,
    GetPublicProfile,
    ListDirectory,
    SaveMyProfile,
    SetFeatured,
)


@dataclass(frozen=True)
class ProfessionalsApp:
    get_my_profile: GetMyProfile
    save_my_profile: SaveMyProfile
    list_directory: ListDirectory
    get_public_profile: GetPublicProfile
    set_featured: SetFeatured
