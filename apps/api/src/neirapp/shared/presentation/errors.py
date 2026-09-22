"""Traducción de errores a respuestas `application/problem+json` (RFC 7807)."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from neirapp.shared.domain.errors import (
    AuthenticationError,
    ConflictError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)

PROBLEM_JSON = "application/problem+json"

_STATUS_BY_ERROR: list[tuple[type[DomainError], int, str]] = [
    (AuthenticationError, 401, "No autenticado"),
    (PermissionDeniedError, 403, "Acceso denegado"),
    (NotFoundError, 404, "No encontrado"),
    (ConflictError, 409, "Conflicto"),
    (ValidationError, 422, "Datos inválidos"),
]


def _problem(status: int, title: str, code: str, detail: str, **extra: Any) -> JSONResponse:
    body = {"type": "about:blank", "title": title, "status": status, "code": code, "detail": detail}
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


async def _handle_domain_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    for error_type, status, title in _STATUS_BY_ERROR:
        if isinstance(exc, error_type):
            response = _problem(status, title, exc.code, exc.message)
            if status == 401:
                response.headers["WWW-Authenticate"] = "Bearer"
            return response
    return _problem(400, "Solicitud inválida", exc.code, exc.message)


async def _handle_request_validation(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return _problem(
        422,
        "Datos inválidos",
        "request_validation_error",
        "La solicitud no es válida.",
        errors=errors,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _handle_domain_error)
    app.add_exception_handler(RequestValidationError, _handle_request_validation)
