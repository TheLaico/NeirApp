""" "¿Quieres formar parte de NeirAPP?": solicitudes públicas para entrar con un rol."""

import httpx
from fastapi import FastAPI

from tests.integration.test_leads_api import API, _admin, _bearer, _register

URL = f"{API}/leads/applications"
COURIER = {
    "role": "courier",
    "full_name": "Juan Pérez",
    "document_number": "1.053.456.789",
    "phone": "310 555 1234",
    "email": "Juan@Correo.com",
    "details": {"Vehículo": "Moto", "Placa": "ABC12D", "Vacío": "  "},
    "message": "Conozco bien Neira.",
}


class TestSolicitudesDeRol:
    async def test_cualquiera_la_envia_sin_cuenta_y_el_admin_la_ve(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        sent = await client.post(URL, json=COURIER)
        assert sent.status_code == 201
        assert sent.json() == {"ok": True}  # pública: no devuelve los datos

        admin = await _admin(client, app)
        listed = (await client.get(URL, headers=_bearer(admin))).json()
        assert len(listed) == 1
        a = listed[0]
        assert a["role"] == "courier"
        assert a["document_number"] == "1053456789"
        assert a["email"] == "juan@correo.com"
        assert a["details"] == {"Vehículo": "Moto", "Placa": "ABC12D"}
        assert a["is_contacted"] is False

        done = await client.patch(
            f"{URL}/{a['id']}", json={"is_contacted": True}, headers=_bearer(admin)
        )
        assert done.json()["is_contacted"] is True

    async def test_empresa_obligatoria_para_negocios(self, client: httpx.AsyncClient) -> None:
        body = {**COURIER, "role": "supplier"}
        response = await client.post(URL, json=body)
        assert response.status_code == 422
        assert response.json()["code"] == "missing_company_name"

        ok = await client.post(URL, json={**body, "company_name": "Lácteos Neira SAS"})
        assert ok.status_code == 201

    async def test_no_se_puede_pedir_admin_ni_cliente(self, client: httpx.AsyncClient) -> None:
        for role in ("admin", "customer", "otro"):
            response = await client.post(URL, json={**COURIER, "role": role})
            assert response.status_code == 422, role
            assert response.json()["code"] == "invalid_application_role"

    async def test_valida_documento_telefono_y_correo(self, client: httpx.AsyncClient) -> None:
        cases = [
            ({"document_number": "12"}, "invalid_document_number"),
            ({"phone": "123"}, "invalid_contact_phone"),
            ({"email": "no-es-un-correo"}, "invalid_contact_email"),
            ({"full_name": "J"}, "invalid_contact_name"),
        ]
        for change, code in cases:
            response = await client.post(URL, json={**COURIER, **change})
            assert response.status_code == 422, change
            assert response.json()["code"] == code

    async def test_trampa_para_bots(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        response = await client.post(URL, json={**COURIER, "website": "http://spam"})
        assert response.status_code == 201
        admin = await _admin(client, app)
        assert (await client.get(URL, headers=_bearer(admin))).json() == []

    async def test_solo_el_admin_ve_la_lista(self, client: httpx.AsyncClient) -> None:
        assert (await client.get(URL)).status_code == 401
        user = await _register(client, "ana@correo.com")
        assert (await client.get(URL, headers=_bearer(user))).status_code == 403
