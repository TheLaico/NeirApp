import { isProblem, type ProblemDetails } from "@neirapp/api-client";

/** Error de negocio o de validación devuelto por la API. */
export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = "ApiError";
    this.problem = problem;
  }

  get code(): string {
    return this.problem.code;
  }
}

/** Convierte cualquier error en un mensaje amigable para mostrar al usuario. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "No hay conexión con el servidor. Inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}

/** Extrae `data` de una respuesta de openapi-fetch o lanza `ApiError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  if (isProblem(result.error)) throw new ApiError(result.error);
  throw new ApiError({
    title: "Error",
    status: result.response.status,
    code: "unknown_error",
    detail: "Ocurrió un error inesperado.",
  });
}
