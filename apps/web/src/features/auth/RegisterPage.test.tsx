import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";
import { useAuthStore } from "./store";

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/registro", element: <RegisterPage /> },
      { path: "/", element: <p>Inicio</p> },
    ],
    { initialEntries: ["/registro"] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Gómez");
  await user.type(screen.getByLabelText("Celular"), "300 123 4567");
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@correo.com");
  await user.type(screen.getByLabelText("Contraseña"), "clave-segura-123");
}

describe("RegisterPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.getState().clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("muestra los errores de validación y no llama a la API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Escribe tu nombre completo")).toBeInTheDocument();
    expect(screen.getByText("Ingresa un celular colombiano válido")).toBeInTheDocument();
    expect(screen.getByText("Debes aceptar los términos para continuar")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no permite registrarse sin aceptar los términos", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Debes aceptar los términos para continuar")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registra al usuario, guarda la sesión y navega al inicio", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "0d1c2a4e-0000-4000-8000-000000000001",
            email: "ana@correo.com",
            full_name: "Ana Gómez",
            phone: "+573001234567",
            roles: ["customer"],
            must_accept_terms: false,
          },
          tokens: { access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 900 },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Inicio")).toBeInTheDocument();
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(await request.clone().json()).toEqual({
      full_name: "Ana Gómez",
      phone: "300 123 4567",
      email: "ana@correo.com",
      password: "clave-segura-123",
      accepted_terms: true,
    });
    expect(useAuthStore.getState().user?.full_name).toBe("Ana Gómez");
  });

  it("muestra el mensaje del servidor cuando el correo ya existe", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: "Conflicto",
          status: 409,
          code: "email_already_registered",
          detail: "Ya existe una cuenta con ese correo.",
        }),
        { status: 409, headers: { "Content-Type": "application/problem+json" } },
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese correo."),
    );
    expect(useAuthStore.getState().user).toBeNull();
  });
});
