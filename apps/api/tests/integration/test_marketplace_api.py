from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

M = f"{API}/marketplace"


def _photo(n: int) -> str:
    return f"/api/v1/uploads/images/{n:032x}.webp"


CASA = {
    "title": "Casa de dos pisos en el centro",
    "kind": "sale",
    "category": "house",
    "description": "Casa de tres habitaciones, dos baños, patio y garaje, cerca del parque.",
    "quantity": 1,
    "photos": [_photo(1), _photo(2)],
    "whatsapp": "310 123 4567",
    "price_cop": 3_500_000_000,  # más de un entero de 32 bits
    "negotiable": True,
}


async def _create(
    client: httpx.AsyncClient, tokens: dict[str, Any], **changes: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{M}/me/listings", json={**CASA, **changes}, headers=_bearer(tokens)
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def _pay(client: httpx.AsyncClient, tokens: dict[str, Any], listing_id: str) -> str:
    response = await client.post(
        f"{M}/me/listings/{listing_id}/payments",
        json={"reference": "Nequi M123"},
        headers=_bearer(tokens),
    )
    assert response.status_code == 201, response.text
    return response.json()["pending_payment"]["id"]  # type: ignore[no-any-return]


async def _published(
    client: httpx.AsyncClient, admin: dict[str, Any], tokens: dict[str, Any], **changes: Any
) -> str:
    listing = await _create(client, tokens, **changes)
    payment_id = await _pay(client, tokens, listing["id"])
    approved = await client.put(f"{M}/admin/payments/{payment_id}/approve", headers=_bearer(admin))
    assert approved.status_code == 200, approved.text
    return listing["id"]  # type: ignore[no-any-return]


async def _public_ids(client: httpx.AsyncClient) -> list[str]:
    return [item["id"] for item in (await client.get(f"{M}/listings")).json()]


async def _inbox(client: httpx.AsyncClient, tokens: dict[str, Any]) -> list[dict[str, Any]]:
    response = await client.get(f"{API}/notifications", headers=_bearer(tokens))
    return response.json()["items"]  # type: ignore[no-any-return]


class TestPublicar:
    async def test_cualquiera_publica_y_se_ve_al_confirmar_el_pago(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")

        listing = await _create(client, seller)
        assert listing["paid_until"] is None and listing["is_active"] is True
        assert listing["whatsapp"] == "3101234567"
        assert await _public_ids(client) == []  # sin pagar no se ve

        payment_id = await _pay(client, seller, listing["id"])
        again = await client.post(
            f"{M}/me/listings/{listing['id']}/payments", json={}, headers=_bearer(seller)
        )
        assert again.json()["code"] == "listing_payment_pending"

        pending = (await client.get(f"{M}/admin/payments", headers=_bearer(admin))).json()
        assert [(p["listing_title"], p["amount_cop"], p["reference"]) for p in pending] == [
            ("Casa de dos pisos en el centro", 10000, "Nequi M123")
        ]
        approved = await client.put(
            f"{M}/admin/payments/{payment_id}/approve", headers=_bearer(admin)
        )
        assert approved.json()["expires_at"].startswith("2026-10-21")

        assert await _public_ids(client) == [listing["id"]]
        public = (await client.get(f"{M}/listings/{listing['id']}")).json()
        assert public["seller_name"] == "Ana"  # solo el nombre de pila
        assert public["negotiable"] is True
        assert public["price_cop"] == 3_500_000_000
        notice = (await _inbox(client, seller))[0]
        assert notice["kind"] == "listing_activated"
        assert "21 de octubre" in notice["body"]

    async def test_renovar_suma_el_mes_al_final(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")
        listing_id = await _published(client, admin, seller)

        payment_id = await _pay(client, seller, listing_id)
        renewed = await client.put(
            f"{M}/admin/payments/{payment_id}/approve", headers=_bearer(admin)
        )
        assert renewed.json()["starts_at"].startswith("2026-10-21")
        assert renewed.json()["expires_at"].startswith("2026-11-20")

    async def test_valida_los_datos(self, client: httpx.AsyncClient) -> None:
        seller = await _register(client, "vendedor@correo.com")
        cases = {
            "invalid_listing_price": {"price_cop": None, "negotiable": False},
            "invalid_listing_photos": {"photos": ["https://otro-sitio.com/foto.jpg"]},
            "invalid_seller_phone": {"whatsapp": "123"},
            "invalid_listing_quantity": {"quantity": 0},
            "invalid_listing_title": {"title": "a"},
        }
        for code, changes in cases.items():
            response = await client.post(
                f"{M}/me/listings", json={**CASA, **changes}, headers=_bearer(seller)
            )
            assert response.json()["code"] == code, code
        # Sin precio vale si lo negocia por chat.
        await _create(client, seller, price_cop=None, negotiable=True)

    async def test_el_admin_rechaza_un_pago(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")
        listing = await _create(client, seller)
        payment_id = await _pay(client, seller, listing["id"])
        url = f"{M}/admin/payments/{payment_id}/reject"

        assert (await client.put(url, json={"note": ""}, headers=_bearer(admin))).status_code == 422
        await client.put(url, json={"note": "No encontramos el pago"}, headers=_bearer(admin))

        mine = (await client.get(f"{M}/me/listings", headers=_bearer(seller))).json()[0]
        assert mine["pending_payment"] is None
        assert mine["rejected_payment"]["note"] == "No encontramos el pago"
        assert (await _inbox(client, seller))[0]["kind"] == "listing_payment_rejected"

    async def test_pausar_eliminar_y_vencer(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")
        other = await _register(client, "otro@correo.com")
        first = await _published(client, admin, seller)
        second = await _published(
            client, admin, seller, title="Apartamento amoblado", kind="rent", category="apartment"
        )

        paused = await client.put(
            f"{M}/me/listings/{first}/active", json={"is_active": False}, headers=_bearer(seller)
        )
        assert paused.json()["is_active"] is False
        assert await _public_ids(client) == [second]

        # Otra persona no la puede tocar.
        stranger = await client.delete(f"{M}/me/listings/{second}", headers=_bearer(other))
        assert stranger.status_code == 404
        deleted = await client.delete(f"{M}/me/listings/{second}", headers=_bearer(seller))
        assert deleted.status_code == 204
        assert (await client.get(f"{M}/listings/{second}")).status_code == 404

        await client.put(
            f"{M}/me/listings/{first}/active", json={"is_active": True}, headers=_bearer(seller)
        )
        assert await _public_ids(client) == [first]
        clock.advance(days=31)
        assert await _public_ids(client) == []


class TestReportes:
    async def test_reportar_avisa_a_los_admins_y_el_admin_decide(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")
        customer = await _register(client, "cliente@correo.com")
        listing_id = await _published(client, admin, seller)
        url = f"{M}/listings/{listing_id}/reports"

        own = await client.post(url, json={"reason": "scam"}, headers=_bearer(seller))
        assert own.json()["code"] == "cannot_report_own_listing"
        no_details = await client.post(url, json={"reason": "other"}, headers=_bearer(customer))
        assert no_details.json()["code"] == "invalid_report_details"

        sent = await client.post(
            url,
            json={"reason": "scam", "details": "Pide pago por adelantado"},
            headers=_bearer(customer),
        )
        assert sent.status_code == 201
        assert "Gracias por reportar" in sent.json()["message"]
        twice = await client.post(url, json={"reason": "spam"}, headers=_bearer(customer))
        assert twice.json()["code"] == "already_reported"
        assert (await _inbox(client, admin))[0]["kind"] == "listing_reported"

        reported = (await client.get(f"{M}/admin/reports", headers=_bearer(admin))).json()
        assert reported[0]["listing"]["id"] == listing_id
        assert [r["reason"] for r in reported[0]["reports"]] == ["scam"]

        # El admin la retira: deja de verse y el vendedor no la puede reactivar.
        removed = await client.put(
            f"{M}/admin/listings/{listing_id}/remove",
            json={"note": "Publicación engañosa"},
            headers=_bearer(admin),
        )
        assert removed.status_code == 204
        assert await _public_ids(client) == []
        assert (await client.get(f"{M}/admin/reports", headers=_bearer(admin))).json() == []
        reactivate = await client.put(
            f"{M}/me/listings/{listing_id}/active",
            json={"is_active": True},
            headers=_bearer(seller),
        )
        assert reactivate.status_code == 403
        assert "listing_removed" in [n["kind"] for n in await _inbox(client, seller)]

        await client.put(f"{M}/admin/listings/{listing_id}/restore", headers=_bearer(admin))
        assert await _public_ids(client) == [listing_id]

    async def test_descartar_reportes(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        seller = await _register(client, "vendedor@correo.com")
        customer = await _register(client, "cliente@correo.com")
        listing_id = await _published(client, admin, seller)
        await client.post(
            f"{M}/listings/{listing_id}/reports",
            json={"reason": "inappropriate"},
            headers=_bearer(customer),
        )

        dismissed = await client.put(
            f"{M}/admin/listings/{listing_id}/dismiss-reports", headers=_bearer(admin)
        )
        assert dismissed.status_code == 204
        assert (await client.get(f"{M}/admin/reports", headers=_bearer(admin))).json() == []
        assert await _public_ids(client) == [listing_id]

    async def test_permisos(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client, "cliente@correo.com")
        for method, url in (
            ("GET", "/admin/payments"),
            ("GET", "/admin/reports"),
            ("PUT", "/admin/listings/00000000-0000-0000-0000-000000000000/remove"),
        ):
            response = await client.request(method, f"{M}{url}", json={}, headers=_bearer(customer))
            assert response.status_code == 403, url
        assert (await client.post(f"{M}/me/listings", json=CASA)).status_code == 401
