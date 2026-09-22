import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { HomePage } from "../features/home/HomePage";

export const router = createBrowserRouter([
  { path: "/ingresar", element: <LoginPage /> },
  { path: "/registro", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [{ path: "/", element: <HomePage /> }],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
