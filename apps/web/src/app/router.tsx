import { createBrowserRouter, Navigate } from "react-router";
import { AdminStoresPage } from "../features/admin/AdminStoresPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { CartPage } from "../features/cart/CartPage";
import { AdminCouriersPage } from "../features/dispatch/AdminCouriersPage";
import { ActiveDeliveryPage } from "../features/dispatch/ActiveDeliveryPage";
import { AvailableDeliveriesPage } from "../features/dispatch/AvailableDeliveriesPage";
import { CourierOnboardingPage } from "../features/dispatch/CourierOnboardingPage";
import { DeliveryHistoryPage } from "../features/dispatch/DeliveryHistoryPage";
import { HomePage } from "../features/home/HomePage";
import { AdminIncidentsPage } from "../features/incidents/AdminIncidentsPage";
import { MyIncidentsPage } from "../features/incidents/MyIncidentsPage";
import { ReportIncidentPage } from "../features/incidents/ReportIncidentPage";
import { CheckoutPage } from "../features/orders/CheckoutPage";
import { OrderDetailPage } from "../features/orders/OrderDetailPage";
import { OrdersPage } from "../features/orders/OrdersPage";
import { StoreOrdersPage } from "../features/orders/StoreOrdersPage";
import { SearchPage } from "../features/search/SearchPage";
import { MyStorePage } from "../features/stores/MyStorePage";
import { StorePage } from "../features/stores/StorePage";
import { WalletPage } from "../features/wallet/WalletPage";

export const router = createBrowserRouter([
  { path: "/ingresar", element: <LoginPage /> },
  { path: "/registro", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/buscar", element: <SearchPage /> },
      { path: "/tiendas/:storeId", element: <StorePage /> },
      { path: "/mi-tienda", element: <MyStorePage /> },
      { path: "/mi-tienda/pedidos", element: <StoreOrdersPage /> },
      { path: "/carrito", element: <CartPage /> },
      { path: "/checkout", element: <CheckoutPage /> },
      { path: "/pedidos", element: <OrdersPage /> },
      { path: "/pedidos/:orderId", element: <OrderDetailPage /> },
      { path: "/pedidos/:orderId/reportar", element: <ReportIncidentPage /> },
      { path: "/mis-reportes", element: <MyIncidentsPage /> },
      { path: "/billetera", element: <WalletPage /> },
      { path: "/repartidor", element: <CourierOnboardingPage /> },
      { path: "/repartidor/disponibles", element: <AvailableDeliveriesPage /> },
      { path: "/repartidor/actual", element: <ActiveDeliveryPage /> },
      { path: "/repartidor/historial", element: <DeliveryHistoryPage /> },
      { path: "/admin/tiendas", element: <AdminStoresPage /> },
      { path: "/admin/repartidores", element: <AdminCouriersPage /> },
      { path: "/admin/incidencias", element: <AdminIncidentsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
