from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

L = f"{API}/lodging"


def _image(n: int) -> str:
    return f"/api/v1/uploads/images/{n:032x}.webp"


HOTEL = {
    "name": "Hotel Mirador de Neira",
    "kind": "hotel",
    "tagline": "Tu descanso con la mejor vista",
    "description": "Habitaciones cómodas con vista panorámica a las montañas de Neira.",
    "address": "Vía Neira - Manizales km 2",
    "lat": 5.1652,
    "lng": -75.5195,
    "phone": "606 851 2345",
    "whatsapp": "310 123 4567",
    "price_from_cop": 180000,
    "photos": [_image(1), _image(2)],
    "amenities": ["wifi", "pool", "restaurant", "wifi"],
}

STAY = {"check_in": "2026-10-01", "check_out": "2026-10-03", "guests": 2, "phone": "300 765 4321"}


async def _hotel(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str, **changes: Any
) -> tuple[dict[str, Any], str]:
    """Autoriza el correo como hospedaje, registra la cuenta y publica su hotel."""
    granted = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "hotel"},
        headers=_bearer(admin),
    )
    assert granted.status_code in (200, 201), granted.text
    owner = await _register(client, email)
    saved = await client.put(f"{L}/me", json={**HOTEL, **changes}, headers=_bearer(owner))
    assert saved.status_code == 200, saved.text
    return owner, saved.json()["id"]


async def _inbox(client: httpx.AsyncClient, who: dict[str, Any]) -> list[str]:
    body = (await client.get(f"{API}/notifications", headers=_bearer(who))).json()
    return [n["kind"] for n in body["items"]]


class TestHoteles:
    async def test_el_hotel_se_publica_y_lo_ven_los_turistas(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        owner, hotel_id = await _hotel(client, admin, "reservas@mirador.co")

        mine = (await client.get(f"{L}/me", headers=_bearer(owner))).json()
        assert mine["phone"] == "6068512345"
        assert mine["whatsapp"] == "3101234567"
        assert mine["amenities"] == ["wifi", "pool", "restaurant"]
        assert mine["is_recommended"] is False

        listed = (await client.get(f"{L}/hotels")).json()
        assert [h["name"] for h in listed] == ["Hotel Mirador de Neira"]
        detail = (await client.get(f"{L}/hotels/{hotel_id}")).json()
        assert detail["rating"] == 0 and detail["reviews_count"] == 0

        hidden = await client.put(
            f"{L}/me", json={**HOTEL, "is_listed": False}, headers=_bearer(owner)
        )
        assert hidden.status_code == 200
        assert (await client.get(f"{L}/hotels")).json() == []
        assert (await client.get(f"{L}/hotels/{hotel_id}")).status_code == 404

    async def test_valida_ubicacion_fotos_y_rol(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        owner, _ = await _hotel(client, admin, "reservas@mirador.co")
        far = await client.put(f"{L}/me", json={**HOTEL, "lat": 4.6}, headers=_bearer(owner))
        assert far.json()["code"] == "invalid_hotel_location"
        bad = await client.put(
            f"{L}/me", json={**HOTEL, "photos": ["https://x.co/a.jpg"]}, headers=_bearer(owner)
        )
        assert bad.json()["code"] == "invalid_hotel_photos"

        tourist = await _register(client, "ana@correo.co")
        denied = await client.put(f"{L}/me", json=HOTEL, headers=_bearer(tourist))
        assert denied.status_code == 403

    async def test_sin_el_rol_deja_de_aparecer(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        await _hotel(client, admin, "reservas@mirador.co")
        revoked = await client.delete(
            f"{API}/identity/admin/role-grants",
            params={"email": "reservas@mirador.co", "role": "hotel"},
            headers=_bearer(admin),
        )
        assert revoked.status_code in (200, 204), revoked.text
        assert (await client.get(f"{L}/hotels")).json() == []
        rows = (await client.get(f"{L}/admin/hotels", headers=_bearer(admin))).json()
        assert rows[0]["has_access"] is False


class TestRecomendados:
    async def test_el_admin_elige_los_recomendados_y_su_banner(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        await _hotel(client, admin, "a@hotel.co", name="Altos de Neira")
        _, finca = await _hotel(client, admin, "b@hotel.co", name="Finca El Paraíso")

        url = f"{L}/admin/hotels/{finca}/recommended"
        bad = await client.put(
            url, json={"recommended": True, "banner_url": "https://x.co/b.jpg"},
            headers=_bearer(admin),
        )  # fmt: skip
        assert bad.status_code == 422
        ok = await client.put(
            url, json={"recommended": True, "banner_url": _image(9)}, headers=_bearer(admin)
        )
        assert ok.json()["is_recommended"] is True
        assert ok.json()["banner_url"] == _image(9)

        listed = (await client.get(f"{L}/hotels")).json()
        assert [h["name"] for h in listed] == ["Finca El Paraíso", "Altos de Neira"]
        tourist = await _register(client, "ana@correo.co")
        denied = await client.put(url, json={"recommended": False}, headers=_bearer(tourist))
        assert denied.status_code == 403


class TestResenas:
    async def test_calificar_responder_y_promedio(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        owner, hotel_id = await _hotel(client, admin, "reservas@mirador.co")
        ana = await _register(client, "ana@correo.co")
        luis = await _register(client, "luis@correo.co")
        mine = f"{L}/hotels/{hotel_id}/reviews/mine"

        assert (await client.put(mine, json={"stars": 6}, headers=_bearer(ana))).json()[
            "code"
        ] == "invalid_review"
        first = await client.put(
            mine, json={"stars": 4, "comment": "Muy limpio"}, headers=_bearer(ana)
        )
        assert first.status_code == 200, first.text
        # Calificar otra vez reemplaza su reseña, no suma otra.
        again = await client.put(
            mine, json={"stars": 5, "comment": "Excelente"}, headers=_bearer(ana)
        )
        assert again.json()["id"] == first.json()["id"]
        await client.put(mine, json={"stars": 4}, headers=_bearer(luis))

        detail = (await client.get(f"{L}/hotels/{hotel_id}")).json()
        assert detail["rating"] == 4.5 and detail["reviews_count"] == 2
        assert (await _inbox(client, owner)).count("hotel_review_new") == 2

        own = await client.put(mine, json={"stars": 5}, headers=_bearer(owner))
        assert own.json()["code"] == "cannot_review_own_hotel"

        review_id = first.json()["id"]
        stranger, _ = await _hotel(client, admin, "otro@hotel.co", name="Otro hotel")
        not_mine = await client.put(
            f"{L}/me/reviews/{review_id}/reply", json={"text": "Hola"}, headers=_bearer(stranger)
        )
        assert not_mine.json()["code"] == "not_your_hotel"
        replied = await client.put(
            f"{L}/me/reviews/{review_id}/reply",
            json={"text": "¡Gracias por visitarnos, Ana!"},
            headers=_bearer(owner),
        )
        assert replied.json()["reply"] == "¡Gracias por visitarnos, Ana!"
        assert "hotel_review_reply" in await _inbox(client, ana)
        public = (await client.get(f"{L}/hotels/{hotel_id}/reviews")).json()
        assert {r["reply"] for r in public} == {"¡Gracias por visitarnos, Ana!", ""}
        panel = (await client.get(f"{L}/me/reviews", headers=_bearer(owner))).json()
        assert len(panel) == 2


class TestReservas:
    async def test_pedir_confirmar_rechazar_y_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        owner, hotel_id = await _hotel(client, admin, "reservas@mirador.co")
        ana = await _register(client, "ana@correo.co")
        url = f"{L}/hotels/{hotel_id}/reservations"

        past = await client.post(url, json={**STAY, "check_in": "2026-09-01"}, headers=_bearer(ana))
        assert past.json()["code"] == "invalid_reservation"
        made = await client.post(url, json=STAY, headers=_bearer(ana))
        assert made.status_code == 201, made.text
        body = made.json()
        assert body["status"] == "pending" and body["nights"] == 2
        assert body["phone"] == "3007654321"
        assert body["hotel"]["name"] == "Hotel Mirador de Neira"
        assert "reservation_new" in await _inbox(client, owner)

        own = await client.post(url, json=STAY, headers=_bearer(owner))
        assert own.json()["code"] == "cannot_book_own_hotel"

        hotel_side = (await client.get(f"{L}/me/reservations", headers=_bearer(owner))).json()
        assert hotel_side[0]["customer_name"] == "Ana Gómez"
        confirmed = await client.put(
            f"{L}/me/reservations/{body['id']}/confirm",
            json={"note": "Te esperamos"},
            headers=_bearer(owner),
        )
        assert confirmed.json()["status"] == "confirmed"
        assert "reservation_confirmed" in await _inbox(client, ana)
        again = await client.put(
            f"{L}/me/reservations/{body['id']}/decline", json={}, headers=_bearer(owner)
        )
        assert again.json()["code"] == "invalid_reservation_transition"

        clock.advance(minutes=1)
        second = (await client.post(url, json=STAY, headers=_bearer(ana))).json()
        declined = await client.put(
            f"{L}/me/reservations/{second['id']}/decline",
            json={"note": "Estamos llenos ese fin de semana"},
            headers=_bearer(owner),
        )
        assert declined.json()["hotel_note"] == "Estamos llenos ese fin de semana"
        assert "reservation_declined" in await _inbox(client, ana)

        # El huésped puede cancelar la confirmada; el hotel recibe el aviso.
        cancelled = await client.put(f"{L}/reservations/{body['id']}/cancel", headers=_bearer(ana))
        assert cancelled.json()["status"] == "cancelled"
        assert "reservation_cancelled" in await _inbox(client, owner)

        mine = (await client.get(f"{L}/reservations/mine", headers=_bearer(ana))).json()
        assert [r["status"] for r in mine] == ["declined", "cancelled"]
        luis = await _register(client, "luis@correo.co")
        foreign = await client.put(f"{L}/reservations/{body['id']}/cancel", headers=_bearer(luis))
        assert foreign.status_code == 404

    async def test_maximo_tres_pendientes_por_hotel(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        _, hotel_id = await _hotel(client, admin, "reservas@mirador.co")
        ana = await _register(client, "ana@correo.co")
        url = f"{L}/hotels/{hotel_id}/reservations"
        for _ in range(3):
            assert (await client.post(url, json=STAY, headers=_bearer(ana))).status_code == 201
        extra = await client.post(url, json=STAY, headers=_bearer(ana))
        assert extra.json()["code"] == "too_many_pending_reservations"
