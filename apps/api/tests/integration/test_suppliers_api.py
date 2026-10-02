from typing import Any

import httpx
from fastapi import FastAPI

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
        user_id = (
            await client.put(
                f"{S}/me", json={**COMPANY, "is_listed": False}, headers=_bearer(company)
            )
        ).json()["user_id"]
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
