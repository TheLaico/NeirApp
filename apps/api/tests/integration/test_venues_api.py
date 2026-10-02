from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

V = f"{API}/venues"


def _image(n: int) -> str:
    return f"/api/v1/uploads/images/{n:032x}.webp"


# Atiende de martes a domingo (cerrado los lunes), de 12:00 a 22:00, hasta 10 personas.
PLACE = {
    "name": "Restaurante El Fogón",
    "category": "restaurant",
    "tagline": "Comida típica caldense",
    "description": "Bandeja paisa, sancocho y frijoles con el mejor sazón de Neira.",
    "address": "Carrera 10 # 9-15, Neira",
    "lat": 5.1660,
    "lng": -75.5200,
    "phone": "606 851 2345",
    "whatsapp": "310 123 4567",
    "photos": [_image(1), _image(2)],
    "features": ["wifi", "parking", "kids", "wifi"],
    "open_time": "12:00",
    "close_time": "22:00",
    "open_days": [1, 2, 3, 4, 5, 6],
    "max_people": 10,
    "price_cop": 25000,
    "price_unit": "person",
}

# El reloj de las pruebas marca el lunes 21 de septiembre de 2026, 7:00 a. m. en Colombia.
TUESDAY = "2026-09-22"


async def _venue(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str, **changes: Any
) -> tuple[dict[str, Any], str]:
    """Autoriza el correo como establecimiento, registra la cuenta y publica su lugar."""
    granted = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "venue"},
        headers=_bearer(admin),
    )
    assert granted.status_code in (200, 201), granted.text
    owner = await _register(client, email)
    saved = await client.put(f"{V}/me", json={**PLACE, **changes}, headers=_bearer(owner))
    assert saved.status_code == 200, saved.text
    return owner, saved.json()["id"]


async def _inbox(client: httpx.AsyncClient, who: dict[str, Any]) -> list[str]:
    body = (await client.get(f"{API}/notifications", headers=_bearer(who))).json()
    return [n["kind"] for n in body["items"]]


def _booking(**changes: Any) -> dict[str, Any]:
    return {"day": TUESDAY, "at": "19:30", "people": 4, "phone": "300 765 4321", **changes}


class TestLugares:
    async def test_el_lugar_se_publica_y_lo_ven_los_clientes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        owner, venue_id = await _venue(client, admin, "hola@fogon.co")
        mine = (await client.get(f"{V}/me", headers=_bearer(owner))).json()
        assert mine["features"] == ["wifi", "parking", "kids"]
        assert mine["open_days"] == [1, 2, 3, 4, 5, 6]
        assert mine["phone"] == "6068512345"

        listed = (await client.get(f"{V}/places")).json()
        assert [v["name"] for v in listed] == ["Restaurante El Fogón"]
        assert (await client.get(f"{V}/places/{venue_id}")).json()["rating"] == 0

        await client.put(f"{V}/me", json={**PLACE, "is_listed": False}, headers=_bearer(owner))
        assert (await client.get(f"{V}/places")).json() == []
        assert (await client.get(f"{V}/places/{venue_id}")).status_code == 404

    async def test_valida_horario_ubicacion_y_rol(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        owner, _ = await _venue(client, admin, "hola@fogon.co")
        no_days = await client.put(
            f"{V}/me", json={**PLACE, "open_days": []}, headers=_bearer(owner)
        )
        assert no_days.json()["code"] == "invalid_venue_schedule"
        far = await client.put(f"{V}/me", json={**PLACE, "lat": 4.6}, headers=_bearer(owner))
        assert far.json()["code"] == "invalid_venue_location"
        tourist = await _register(client, "ana@correo.co")
        assert (
            await client.put(f"{V}/me", json=PLACE, headers=_bearer(tourist))
        ).status_code == 403

    async def test_el_admin_destaca_lugares(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        await _venue(client, admin, "a@lugar.co", name="Cancha La 10", category="sports")
        _, salon = await _venue(client, admin, "b@lugar.co", name="Salón Los Robles")
        featured = await client.put(
            f"{V}/admin/places/{salon}/featured",
            json={"featured": True, "banner_url": _image(9)},
            headers=_bearer(admin),
        )
        assert featured.json()["is_featured"] is True
        listed = (await client.get(f"{V}/places")).json()
        assert [v["name"] for v in listed] == ["Salón Los Robles", "Cancha La 10"]
        rows = (await client.get(f"{V}/admin/places", headers=_bearer(admin))).json()
        assert rows[0]["has_access"] is True


class TestReservas:
    async def test_pedir_confirmar_rechazar_y_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        owner, venue_id = await _venue(client, admin, "hola@fogon.co")
        ana = await _register(client, "ana@correo.co")
        url = f"{V}/places/{venue_id}/bookings"

        made = await client.post(url, json=_booking(), headers=_bearer(ana))
        assert made.status_code == 201, made.text
        body = made.json()
        assert body["status"] == "pending" and body["at"] == "19:30"
        assert body["phone"] == "3007654321"
        assert body["venue"]["name"] == "Restaurante El Fogón"
        assert "booking_new" in await _inbox(client, owner)

        side = (await client.get(f"{V}/me/bookings", headers=_bearer(owner))).json()
        assert side[0]["customer_name"] == "Ana Gómez"
        confirmed = await client.put(
            f"{V}/me/bookings/{body['id']}/confirm", json={"note": "Mesa junto a la ventana"},
            headers=_bearer(owner),
        )  # fmt: skip
        assert confirmed.json()["status"] == "confirmed"
        assert "booking_confirmed" in await _inbox(client, ana)

        clock.advance(minutes=1)
        second = (await client.post(url, json=_booking(at="20:00"), headers=_bearer(ana))).json()
        declined = await client.put(
            f"{V}/me/bookings/{second['id']}/decline", json={"note": "Ya estamos llenos"},
            headers=_bearer(owner),
        )  # fmt: skip
        assert declined.json()["venue_note"] == "Ya estamos llenos"
        assert "booking_declined" in await _inbox(client, ana)

        cancelled = await client.put(f"{V}/bookings/{body['id']}/cancel", headers=_bearer(ana))
        assert cancelled.json()["status"] == "cancelled"
        assert "booking_cancelled" in await _inbox(client, owner)
        mine = (await client.get(f"{V}/bookings/mine", headers=_bearer(ana))).json()
        assert [b["status"] for b in mine] == ["declined", "cancelled"]

        own = await client.post(url, json=_booking(), headers=_bearer(owner))
        assert own.json()["code"] == "cannot_book_own_venue"

    async def test_respeta_horario_dias_y_capacidad(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        _, venue_id = await _venue(client, admin, "hola@fogon.co")
        ana = await _register(client, "ana@correo.co")
        url = f"{V}/places/{venue_id}/bookings"

        async def code(**changes: Any) -> str:
            r = await client.post(url, json=_booking(**changes), headers=_bearer(ana))
            return r.json()["code"]  # type: ignore[no-any-return]

        assert await code(day="2026-09-28") == "venue_closed"  # Lunes: cerrado
        assert await code(at="10:00") == "venue_closed"  # Antes de abrir
        assert await code(at="22:00") == "venue_closed"  # Ya cerró
        assert await code(people=11) == "too_many_people"
        assert await code(day="2026-09-20") == "invalid_booking"  # Ayer
        assert await code(day="2027-06-01") == "invalid_booking"  # Más de 180 días
        assert await code(at="7pm") == "invalid_booking"

    async def test_horario_que_pasa_la_medianoche(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        # Bar de viernes y sábado, de 20:00 a 02:00.
        _, venue_id = await _venue(
            client, admin, "bar@neira.co", category="bar", open_time="20:00", close_time="02:00",
            open_days=[4, 5],
        )  # fmt: skip
        ana = await _register(client, "ana@correo.co")
        url = f"{V}/places/{venue_id}/bookings"
        friday_night = await client.post(
            url, json=_booking(day="2026-09-25", at="23:00"), headers=_bearer(ana)
        )
        assert friday_night.status_code == 201
        saturday_dawn = await client.post(
            url, json=_booking(day="2026-09-26", at="01:00"), headers=_bearer(ana)
        )
        assert saturday_dawn.status_code == 201  # Sigue siendo la noche del viernes
        friday_dawn = await client.post(
            url, json=_booking(day="2026-09-25", at="01:00"), headers=_bearer(ana)
        )
        assert friday_dawn.json()["code"] == "venue_closed"  # Jueves no abrió

    async def test_maximo_tres_pendientes_por_lugar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        _, venue_id = await _venue(client, admin, "hola@fogon.co")
        ana = await _register(client, "ana@correo.co")
        url = f"{V}/places/{venue_id}/bookings"
        for _ in range(3):
            assert (
                await client.post(url, json=_booking(), headers=_bearer(ana))
            ).status_code == 201
        extra = await client.post(url, json=_booking(), headers=_bearer(ana))
        assert extra.json()["code"] == "too_many_pending_bookings"


class TestResenas:
    async def test_calificar_y_responder(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        owner, venue_id = await _venue(client, admin, "hola@fogon.co")
        ana = await _register(client, "ana@correo.co")
        mine = f"{V}/places/{venue_id}/reviews/mine"
        first = await client.put(mine, json={"stars": 4, "comment": "Rico"}, headers=_bearer(ana))
        again = await client.put(mine, json={"stars": 5}, headers=_bearer(ana))
        assert again.json()["id"] == first.json()["id"]
        assert (await client.get(f"{V}/places/{venue_id}")).json()["rating"] == 5
        assert "venue_review_new" in await _inbox(client, owner)
        own = await client.put(mine, json={"stars": 5}, headers=_bearer(owner))
        assert own.json()["code"] == "cannot_review_own_venue"

        replied = await client.put(
            f"{V}/me/reviews/{first.json()['id']}/reply", json={"text": "¡Gracias, Ana!"},
            headers=_bearer(owner),
        )  # fmt: skip
        assert replied.json()["reply"] == "¡Gracias, Ana!"
        assert "venue_review_reply" in await _inbox(client, ana)
