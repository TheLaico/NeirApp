from dataclasses import dataclass

from neirapp.modules.professionals.application.appointments import (
    CancelByCustomer,
    CancelByProfessional,
    CompleteRequest,
    ListReceivedRequests,
    ListSentRequests,
    RejectRequest,
    ScheduleRequest,
    SendRequest,
)
from neirapp.modules.professionals.application.categories import (
    AddSubcategory,
    CreateCategory,
    DeleteCategory,
    DeleteSubcategory,
    ListCategories,
    SetSubcategoryColor,
)
from neirapp.modules.professionals.application.certificates import (
    AddCertificate,
    DeleteCertificate,
    ListMyCertificates,
    ListPendingCertificates,
    ListPublicCertificates,
    ReviewCertificate,
    UpdateCertificate,
)
from neirapp.modules.professionals.application.gallery import (
    AddGalleryImage,
    DeleteGalleryImage,
    ListMyGallery,
    ListPublicGallery,
    ReorderGallery,
    SetGalleryCaption,
)
from neirapp.modules.professionals.application.notifications import (
    DeleteNotification,
    ListMyNotifications,
    MarkNotificationRead,
)
from neirapp.modules.professionals.application.profiles import (
    GetMyProfile,
    GetPublicProfile,
    ListDirectory,
    SaveMyProfile,
    SetFeatured,
    UpdateMySettings,
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
    update_my_settings: UpdateMySettings
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
    list_my_gallery: ListMyGallery
    add_gallery_image: AddGalleryImage
    set_gallery_caption: SetGalleryCaption
    reorder_gallery: ReorderGallery
    delete_gallery_image: DeleteGalleryImage
    list_public_gallery: ListPublicGallery
    list_my_certificates: ListMyCertificates
    add_certificate: AddCertificate
    update_certificate: UpdateCertificate
    delete_certificate: DeleteCertificate
    list_pending_certificates: ListPendingCertificates
    review_certificate: ReviewCertificate
    list_public_certificates: ListPublicCertificates
    send_request: SendRequest
    list_received_requests: ListReceivedRequests
    schedule_request: ScheduleRequest
    reject_request: RejectRequest
    complete_request: CompleteRequest
    cancel_by_professional: CancelByProfessional
    list_sent_requests: ListSentRequests
    cancel_by_customer: CancelByCustomer
    list_my_notifications: ListMyNotifications
    mark_notification_read: MarkNotificationRead
    delete_notification: DeleteNotification
