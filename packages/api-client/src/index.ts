import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths };
export type Schemas = components["schemas"];

export interface ApiClientOptions {
  baseUrl: string;
  /** Devuelve un access token vigente (refrescándolo si hace falta) o null si no hay sesión. */
  getAccessToken?: () => Promise<string | null>;
}

/** Cliente tipado de la API. Lo comparten la web y la futura app móvil. */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  // `fetch` se resuelve en cada petición (no al crear el cliente) para poder sustituirlo en tests
  // o con polyfills en móvil.
  const client = createClient<paths>({ baseUrl, fetch: (request) => globalThis.fetch(request) });

  if (getAccessToken) {
    const auth: Middleware = {
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    };
    client.use(auth);
  }
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Error de negocio devuelto por la API (application/problem+json). */
export interface ProblemDetails {
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: { loc: (string | number)[]; msg: string; type: string }[];
}

export function isProblem(value: unknown): value is ProblemDetails {
  return typeof value === "object" && value !== null && "code" in value && "status" in value;
}
