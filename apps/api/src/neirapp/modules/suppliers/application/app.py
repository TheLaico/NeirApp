from dataclasses import dataclass

from neirapp.modules.suppliers.application.use_cases import (
    ApproveSubscriptionPayment,
    CancelSubscriptionPayment,
    EndSubscription,
    GetMySubscription,
    GetMySupplier,
    GetSupplier,
    GrantSubscriptionMonth,
    ListSuppliers,
    ListSupplierSubscriptions,
    RejectSubscriptionPayment,
    RequestSubscriptionPayment,
    SaveMySupplier,
)


@dataclass(frozen=True)
class SuppliersApp:
    """Fachada del módulo Proveedores (empresas que venden al por mayor)."""

    get_my_supplier: GetMySupplier
    save_my_supplier: SaveMySupplier
    list_suppliers: ListSuppliers
    get_supplier: GetSupplier
    get_my_subscription: GetMySubscription
    request_subscription_payment: RequestSubscriptionPayment
    cancel_subscription_payment: CancelSubscriptionPayment
    list_supplier_subscriptions: ListSupplierSubscriptions
    approve_subscription_payment: ApproveSubscriptionPayment
    reject_subscription_payment: RejectSubscriptionPayment
    grant_subscription_month: GrantSubscriptionMonth
    end_subscription: EndSubscription
