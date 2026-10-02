from dataclasses import dataclass

from neirapp.modules.marketplace.application.use_cases import (
    ApprovePayment,
    CancelPayment,
    CreateListing,
    DeleteListing,
    DismissReports,
    GetPublicListing,
    ListMyListings,
    ListPendingPayments,
    ListPublicListings,
    ListReportedListings,
    RejectPayment,
    RemoveListing,
    ReportListing,
    RequestPayment,
    RestoreListing,
    SetListingActive,
    UpdateListing,
)


@dataclass(frozen=True)
class MarketplaceApp:
    """Fachada del módulo MarquetNeira (muebles en venta y alquiler)."""

    list_my_listings: ListMyListings
    create_listing: CreateListing
    update_listing: UpdateListing
    set_listing_active: SetListingActive
    delete_listing: DeleteListing
    list_public_listings: ListPublicListings
    get_public_listing: GetPublicListing
    request_payment: RequestPayment
    cancel_payment: CancelPayment
    list_pending_payments: ListPendingPayments
    approve_payment: ApprovePayment
    reject_payment: RejectPayment
    report_listing: ReportListing
    list_reported_listings: ListReportedListings
    dismiss_reports: DismissReports
    remove_listing: RemoveListing
    restore_listing: RestoreListing
