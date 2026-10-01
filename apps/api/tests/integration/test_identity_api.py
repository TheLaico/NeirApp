from collections.abc import Callable
from typing import Any
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI

from neirapp.bootstrap.app import create_app
from neirapp.bootstrap.settings import Settings
from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel
from tests.conftest import FakeClock

API = "/api/v1/identity"

VALID = {
    "email": "ana@correo.com",
    "password": "clave-segura-123",
    "full_name": "Ana Gómez",
    "phone": "300 123 4567",
    "accepted_terms": True,
}


async def register(client: httpx.AsyncClient, **overrides: Any) -> httpx.Response:
    return await client.post(f"{API}/register", json={**VALID, **overrides})


def bearer(tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_health(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


class TestRegister:
    async def test_crea_cliente_con_sesion(self, client: httpx.AsyncClient) -> None:
        response = await register(client)

        assert response.status_code == 201
        body = response.json()
        assert body["user"]["email"] == "ana@correo.com"
        assert body["user"]["phone"] == "+573001234567"
        assert body["user"]["roles"] == ["customer"]
        assert body["user"]["must_accept_terms"] is False
        assert body["tokens"]["token_type"] == "bearer"
        assert body["tokens"]["expires_in"] == 900
        assert "password" not in response.text

    async def test_exige_aceptar_terminos(self, client: httpx.AsyncClient) -> None:
        response = await register(client, accepted_terms=False)
        assert response.status_code == 422
        assert response.json()["code"] == "terms_not_accepted"

    async def test_correo_duplicado_ignora_mayusculas(self, client: httpx.AsyncClient) -> None:
        assert (await register(client)).status_code == 201
        response = await register(client, email="ANA@Correo.com")
        assert response.status_code == 409
        assert response.json()["code"] == "email_already_registered"

    async def test_telefono_invalido(self, client: httpx.AsyncClient) -> None:
        response = await register(client, phone="12345")
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_phone"

    async def test_contrasena_corta_la_rechaza_la_validacion_del_request(
        self, client: httpx.AsyncClient
    ) -> None:
        response = await register(client, password="corta")
        assert response.status_code == 422
        assert response.headers["content-type"].startswith("application/problem+json")
        assert response.json()["code"] == "request_validation_error"

    async def test_guarda_la_aceptacion_de_terminos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        from sqlalchemy import text

        await register(client)
        async with app.state.engine.connect() as conn:
            rows = (
                await conn.execute(
                    text(
                        "select document, version from identity_terms_acceptances order by document"
                    )
                )
            ).all()
        assert [tuple(r) for r in rows] == [
            ("privacy_policy", "2026-09-01"),
            ("terms_and_conditions", "2026-09-01"),
        ]


class TestLogin:
    async def test_ok(self, client: httpx.AsyncClient) -> None:
        await register(client)
        response = await client.post(
            f"{API}/login", json={"email": " ANA@correo.com ", "password": VALID["password"]}
        )
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "ana@correo.com"

    @pytest.mark.parametrize(
        ("email", "password"),
        [("ana@correo.com", "incorrecta-123"), ("nadie@correo.com", "clave-segura-123")],
    )
    async def test_credenciales_invalidas_dan_el_mismo_error(
        self, client: httpx.AsyncClient, email: str, password: str
    ) -> None:
        await register(client)
        response = await client.post(f"{API}/login", json={"email": email, "password": password})
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_credentials"
        assert response.headers["www-authenticate"] == "Bearer"


class TestMe:
    async def test_requiere_token(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/me")
        assert response.status_code == 401

    async def test_rechaza_token_basura(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/me", headers={"Authorization": "Bearer abc.def.ghi"})
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_token"

    async def test_devuelve_el_perfil(self, client: httpx.AsyncClient) -> None:
        tokens = (await register(client)).json()["tokens"]
        response = await client.get(f"{API}/me", headers=bearer(tokens))
        assert response.status_code == 200
        assert response.json()["full_name"] == "Ana Gómez"

    async def test_token_expirado(self, client: httpx.AsyncClient, clock: FakeClock) -> None:
        tokens = (await register(client)).json()["tokens"]
        clock.advance(minutes=16)
        response = await client.get(f"{API}/me", headers=bearer(tokens))
        assert response.status_code == 401

    async def test_actualiza_datos_de_contacto(self, client: httpx.AsyncClient) -> None:
        tokens = (await register(client)).json()["tokens"]
        response = await client.patch(
            f"{API}/me", headers=bearer(tokens), json={"phone": "+57 310 555 0000"}
        )
        assert response.status_code == 200
        assert response.json()["phone"] == "+573105550000"
        assert response.json()["full_name"] == "Ana Gómez"


class TestRefresh:
    async def test_rota_el_refresh_token(self, client: httpx.AsyncClient) -> None:
        first = (await register(client)).json()["tokens"]
        response = await client.post(
            f"{API}/refresh", json={"refresh_token": first["refresh_token"]}
        )
        assert response.status_code == 200
        second = response.json()["tokens"]
        assert second["refresh_token"] != first["refresh_token"]

        me = await client.get(f"{API}/me", headers=bearer(second))
        assert me.status_code == 200

    async def test_reusar_un_token_rotado_revoca_toda_la_cadena(
        self, client: httpx.AsyncClient
    ) -> None:
        first = (await register(client)).json()["tokens"]
        second = (
            await client.post(f"{API}/refresh", json={"refresh_token": first["refresh_token"]})
        ).json()["tokens"]

        reuse = await client.post(f"{API}/refresh", json={"refresh_token": first["refresh_token"]})
        assert reuse.status_code == 401

        # El token legítimo más nuevo también queda revocado.
        after = await client.post(f"{API}/refresh", json={"refresh_token": second["refresh_token"]})
        assert after.status_code == 401

    async def test_refresh_expirado(self, client: httpx.AsyncClient, clock: FakeClock) -> None:
        tokens = (await register(client)).json()["tokens"]
        clock.advance(days=31)
        response = await client.post(
            f"{API}/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert response.status_code == 401

    async def test_refresh_desconocido(self, client: httpx.AsyncClient) -> None:
        response = await client.post(f"{API}/refresh", json={"refresh_token": "no-existe"})
        assert response.status_code == 401

    async def test_logout_invalida_el_refresh(self, client: httpx.AsyncClient) -> None:
        tokens = (await register(client)).json()["tokens"]
        out = await client.post(f"{API}/logout", json={"refresh_token": tokens["refresh_token"]})
        assert out.status_code == 204
        again = await client.post(f"{API}/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert again.status_code == 401

    async def test_logout_es_idempotente(self, client: httpx.AsyncClient) -> None:
        out = await client.post(f"{API}/logout", json={"refresh_token": "no-existe"})
        assert out.status_code == 204


class TestRoles:
    async def test_cliente_no_entra_a_ruta_de_admin(self, client: httpx.AsyncClient) -> None:
        tokens = (await register(client)).json()["tokens"]
        response = await client.get("/_test/admin-only", headers=bearer(tokens))
        assert response.status_code == 403
        assert response.json()["code"] == "insufficient_role"

    async def test_admin_si_entra(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        body = (await register(client)).json()
        async with app.state.engine.begin() as conn:
            await conn.execute(
                UserRoleModel.__table__.insert().values(
                    user_id=UUID(body["user"]["id"]), role=Role.ADMIN.value
                )
            )
        response = await client.get("/_test/admin-only", headers=bearer(body["tokens"]))
        assert response.status_code == 200


class TestTermsVersioning:
    async def test_expone_las_versiones_vigentes_sin_autenticacion(
        self, client: httpx.AsyncClient
    ) -> None:
        response = await client.get(f"{API}/terms")
        assert response.status_code == 200
        assert response.json() == {
            "documents": [
                {"document": "terms_and_conditions", "version": "2026-09-01"},
                {"document": "privacy_policy", "version": "2026-09-01"},
            ]
        }

    async def test_nueva_version_obliga_a_reaceptar(
        self, client: httpx.AsyncClient, make_settings: Callable[..., Settings], clock: FakeClock
    ) -> None:
        tokens = (await register(client)).json()["tokens"]

        # Se publica una nueva versión de los términos sobre la misma base de datos.
        new_app = create_app(make_settings(terms_version="2026-12-01"), clock=clock)
        transport = httpx.ASGITransport(app=new_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as new_client:
            me = await new_client.get(f"{API}/me", headers=bearer(tokens))
            assert me.json()["must_accept_terms"] is True

            wrong = await new_client.post(
                f"{API}/terms/accept",
                headers=bearer(tokens),
                json={"document": "terms_and_conditions", "version": "1999-01-01"},
            )
            assert wrong.status_code == 422
            assert wrong.json()["code"] == "terms_version_mismatch"

            ok = await new_client.post(
                f"{API}/terms/accept",
                headers=bearer(tokens),
                json={"document": "terms_and_conditions", "version": "2026-12-01"},
            )
            assert ok.status_code == 200
            assert ok.json()["must_accept_terms"] is False
        await new_app.state.engine.dispose()
