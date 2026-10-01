import { isProblem, type ProblemDetails } from "@neirapp/api-client";

/** Error de negocio o de validación devuelto por la API. Idéntico al de `apps/web`. */
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

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "No hay conexión con el servidor. Inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}

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
