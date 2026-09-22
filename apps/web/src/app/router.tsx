import { createBrowserRouter, Navigate } from "react-router";
import { AdminStoresPage } from "../features/admin/AdminStoresPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { CartPage } from "../features/cart/CartPage";
import { HomePage } from "../features/home/HomePage";
import { CheckoutPage } from "../features/orders/CheckoutPage";
import { OrderDetailPage } from "../features/orders/OrderDetailPage";
import { OrdersPage } from "../features/orders/OrdersPage";
import { StoreOrdersPage } from "../features/orders/StoreOrdersPage";
import { SearchPage } from "../features/search/SearchPage";
import { MyStorePage } from "../features/stores/MyStorePage";
import { StorePage } from "../features/stores/StorePage";

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
      { path: "/admin/tiendas", element: <AdminStoresPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
