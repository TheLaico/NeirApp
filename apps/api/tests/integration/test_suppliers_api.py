from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

S = f"{API}/suppliers"


def _image(n: int) -> str:
    return f"/api/v1/uploads/images/{n:032x}.webp"


COMPANY = {
    "company_name": "Productos del Campo",
    "tagline": "Alimentos al por mayor",
    "category": "food",
    "description": "Distribuimos productos agrícolas, lácteos y conservas directamente del campo.",
    "phone": "606 851 2345",
    "whatsapp": "310 123 4567",
    "email": "Ventas@Campo.co",
    "facebook": "https://www.facebook.com/productosdelcampo",
    "instagram": "@productosdelcampo",
    "logo_url": _image(1),
    "cover_url": _image(2),
    "catalog_url": _image(3),
}


async def _supplier(client: httpx.AsyncClient, admin: dict[str, Any], email: str) -> dict[str, Any]:
    granted = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "supplier"},
        headers=_bearer(admin),
    )
    assert granted.status_code in (200, 201), granted.text
    return await _register(client, email)


async def _published(
    client: httpx.AsyncClient, admin: dict[str, Any], company: dict[str, Any], **changes: Any
) -> str:
    """Guarda el perfil y el admin le activa un mes de suscripción."""
    saved = await client.put(f"{S}/me", json={**COMPANY, **changes}, headers=_bearer(company))
    user_id = saved.json()["user_id"]
    granted = await client.post(f"{S}/admin/{user_id}/grant-month", headers=_bearer(admin))
    assert granted.status_code == 200, granted.text
    return user_id  # type: ignore[no-any-return]


class TestProveedores:
    async def test_la_empresa_arma_su_perfil_y_sale_en_el_directorio(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")

        assert (await client.get(f"{S}/me", headers=_bearer(company))).status_code == 404
        saved = await client.put(f"{S}/me", json=COMPANY, headers=_bearer(company))
        assert saved.status_code == 200, saved.text
        body = saved.json()
        assert body["phone"] == "6068512345"
        assert body["whatsapp"] == "3101234567"
        assert body["email"] == "ventas@campo.co"
        assert body["instagram"] == "https://www.instagram.com/productosdelcampo"

        assert (await client.get(S)).json() == []  # sin suscripción no aparece
        await client.post(f"{S}/admin/{body['user_id']}/grant-month", headers=_bearer(admin))
        listed = (await client.get(S)).json()
        assert [s["company_name"] for s in listed] == ["Productos del Campo"]
        assert (await client.get(f"{S}?category=food")).json() != []
        assert (await client.get(f"{S}?category=technology")).json() == []
        public = await client.get(f"{S}/{body['user_id']}")
        assert public.json()["catalog_url"] == _image(3)

    async def test_oculto_o_sin_acceso_no_se_ve(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")
        user_id = await _published(client, admin, company, is_listed=False)
        assert (await client.get(S)).json() == []
        assert (await client.get(f"{S}/{user_id}")).status_code == 404

        await client.put(f"{S}/me", json=COMPANY, headers=_bearer(company))
        await client.delete(
            f"{API}/identity/admin/role-grants",
            params={"email": "ventas@campo.co", "role": "supplier"},
            headers=_bearer(admin),
        )
        assert (await client.get(S)).json() == []

    async def test_valida_los_datos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")
        cases = {
            "invalid_company_name": {"company_name": "a"},
            "invalid_supplier_description": {"description": "corta"},
            "invalid_supplier_phone": {"phone": "12"},
            "invalid_supplier_whatsapp": {"whatsapp": "123"},
            "invalid_supplier_email": {"email": "no-es-correo"},
            "invalid_supplier_link": {"facebook": "https://otro-sitio.com/x"},
            "invalid_supplier_image": {"catalog_url": "https://otro-sitio.com/a.png"},
        }
        for code, changes in cases.items():
            response = await client.put(
                f"{S}/me", json={**COMPANY, **changes}, headers=_bearer(company)
            )
            assert response.json()["code"] == code, code

    async def test_solo_proveedores_autorizados(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client, "cliente@correo.com")
        response = await client.put(f"{S}/me", json=COMPANY, headers=_bearer(customer))
        assert response.status_code == 403


class TestSuscripcion:
    async def test_paga_y_el_admin_confirma(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")
        sub_url = f"{S}/me/subscription"

        # Sin perfil no puede pagar.
        early = await client.post(f"{sub_url}/payments", json={}, headers=_bearer(company))
        assert early.json()["code"] == "supplier_profile_required"
        await client.put(f"{S}/me", json=COMPANY, headers=_bearer(company))

        sent = await client.post(
            f"{sub_url}/payments", json={"reference": "Nequi M77"}, headers=_bearer(company)
        )
        assert sent.status_code == 201
        assert sent.json()["fee_cop"] == 24900
        pending = sent.json()["pending"]
        assert (pending["amount_cop"], pending["reference"]) == (24900, "Nequi M77")
        again = await client.post(f"{sub_url}/payments", json={}, headers=_bearer(company))
        assert again.json()["code"] == "supplier_payment_pending"

        rows = (await client.get(f"{S}/admin/subscriptions", headers=_bearer(admin))).json()
        assert rows[0]["subscription"]["pending"]["id"] == pending["id"]

        approved = await client.put(
            f"{S}/admin/payments/{pending['id']}/approve", headers=_bearer(admin)
        )
        assert approved.json()["expires_at"].startswith("2026-10-21")
        assert len((await client.get(S)).json()) == 1
        inbox = (await client.get(f"{API}/notifications", headers=_bearer(company))).json()
        assert inbox["items"][0]["kind"] == "supplier_activated"

        # Renovar suma el mes al final; al vencer deja de aparecer.
        renewal = (
            await client.post(f"{sub_url}/payments", json={}, headers=_bearer(company))
        ).json()["pending"]
        renewed = await client.put(
            f"{S}/admin/payments/{renewal['id']}/approve", headers=_bearer(admin)
        )
        assert renewed.json()["expires_at"].startswith("2026-11-20")
        clock.advance(days=61)
        assert (await client.get(S)).json() == []

    async def test_rechazar_cancelar_y_quitar(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")
        user_id = await _published(client, admin, company)
        sub_url = f"{S}/me/subscription"

        pending = (
            await client.post(f"{sub_url}/payments", json={}, headers=_bearer(company))
        ).json()["pending"]
        cancelled = await client.put(
            f"{sub_url}/payments/{pending['id']}/cancel", headers=_bearer(company)
        )
        assert cancelled.json()["pending"] is None

        clock.advance(minutes=1)
        pending = (
            await client.post(f"{sub_url}/payments", json={}, headers=_bearer(company))
        ).json()["pending"]
        url = f"{S}/admin/payments/{pending['id']}/reject"
        assert (await client.put(url, json={"note": ""}, headers=_bearer(admin))).status_code == 422
        await client.put(url, json={"note": "No vimos el pago"}, headers=_bearer(admin))
        mine = (await client.get(sub_url, headers=_bearer(company))).json()
        assert mine["rejected"]["note"] == "No vimos el pago"

        ended = await client.put(f"{S}/admin/{user_id}/end", headers=_bearer(admin))
        assert ended.status_code == 200
        assert (await client.get(S)).json() == []

    async def test_solo_el_admin_confirma(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        company = await _supplier(client, admin, "ventas@campo.co")
        for method, url in (
            ("GET", "/admin/subscriptions"),
            ("PUT", "/admin/payments/00000000-0000-0000-0000-000000000000/approve"),
        ):
            response = await client.request(method, f"{S}{url}", headers=_bearer(company))
            assert response.status_code == 403, url
