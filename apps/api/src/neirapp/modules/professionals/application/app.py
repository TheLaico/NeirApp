from dataclasses import dataclass

from neirapp.modules.professionals.application.categories import (
    AddSubcategory,
    CreateCategory,
    DeleteCategory,
    DeleteSubcategory,
    ListCategories,
    SetSubcategoryColor,
)
from neirapp.modules.professionals.application.profiles import (
    GetMyProfile,
    GetPublicProfile,
    ListDirectory,
    SaveMyProfile,
    SetFeatured,
)
from neirapp.modules.professionals.application.services import (
    AddService,
    DeleteService,
    ListMyServices,
    ListPublicServices,
    UpdateService,
)


@dataclass(frozen=True)
class ProfessionalsApp:
    get_my_profile: GetMyProfile
    save_my_profile: SaveMyProfile
    list_directory: ListDirectory
    get_public_profile: GetPublicProfile
    set_featured: SetFeatured
    list_categories: ListCategories
    create_category: CreateCategory
    delete_category: DeleteCategory
    add_subcategory: AddSubcategory
    set_subcategory_color: SetSubcategoryColor
    delete_subcategory: DeleteSubcategory
    list_my_services: ListMyServices
    add_service: AddService
    update_service: UpdateService
    delete_service: DeleteService
    list_public_services: ListPublicServices
