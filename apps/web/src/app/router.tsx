import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { CartPage } from "../features/cart/CartPage";
import { HomePage } from "../features/home/HomePage";
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
      { path: "/carrito", element: <CartPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
