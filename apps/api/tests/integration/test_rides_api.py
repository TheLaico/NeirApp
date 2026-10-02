from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

R = f"{API}/rides"

# Puntos dentro del mapa de Neira.
PLAZA = {"lat": 5.1680, "lng": -75.5198}
TERMINAL = {"lat": 5.1640, "lng": -75.5230}
PICKUP = {"passengers": 2, **PLAZA, "address": "Calle 8 #4-21", "reference": "Frente al parque"}


async def _driver(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str, *, online: bool = True
) -> dict[str, Any]:
    """Autoriza el correo como conductor, registra la cuenta, crea su perfil y lo pone disponible
    con una ubicación."""
    granted = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "driver"},
        headers=_bearer(admin),
    )
    assert granted.status_code in (200, 201), granted.text
    driver = await _register(client, email)
    saved = await client.put(
        f"{R}/driver/me",
        json={
            "name": "Juan Pérez",
            "phone": "310 123 4567",
            "plate": "nei-123",
            "model_year": 2023,
        },
        headers=_bearer(driver),
    )
    assert saved.status_code == 200, saved.text
    if online:
        await client.put(f"{R}/driver/status", json={"online": True}, headers=_bearer(driver))
        await client.put(f"{R}/driver/location", json=TERMINAL, headers=_bearer(driver))
    return driver


async def _login(client: httpx.AsyncClient, email: str) -> dict[str, Any]:
    """Vuelve a iniciar sesión (después de adelantar el reloj, el token anterior ya venció)."""
    r = await client.post(
        f"{API}/identity/login", json={"email": email, "password": "clave-segura-123"}
    )
    return r.json()["tokens"]  # type: ignore[no-any-return]


async def _inbox(client: httpx.AsyncClient, who: dict[str, Any]) -> list[str]:
    body = (await client.get(f"{API}/notifications", headers=_bearer(who))).json()
    return [n["kind"] for n in body["items"]]


class TestConductor:
    async def test_perfil_disponibilidad_y_mapa(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        driver = await _driver(client, admin, "juan@moto.co", online=False)
        me = (await client.get(f"{R}/driver/me", headers=_bearer(driver))).json()
        assert me["plate"] == "NEI123" and me["plate_label"] == "NEI-123"
        assert me["capacity"] == 3 and me["is_online"] is False

        ana = await _register(client, "ana@correo.co")
        assert (await client.get(f"{R}/drivers/live", headers=_bearer(ana))).json() == []
        await client.put(f"{R}/driver/status", json={"online": True}, headers=_bearer(driver))
        far = await client.put(
            f"{R}/driver/location", json={"lat": 4.6, "lng": -74.1}, headers=_bearer(driver)
        )
        assert far.json()["code"] == "invalid_ride_location"
        await client.put(f"{R}/driver/location", json=TERMINAL, headers=_bearer(driver))
        live = (await client.get(f"{R}/drivers/live", headers=_bearer(ana))).json()
        assert live == [{**TERMINAL, "busy": False}]

        bad = await client.put(
            f"{R}/driver/me", json={"name": "Juan", "phone": "123", "plate": "NEI123"},
            headers=_bearer(driver),
        )  # fmt: skip
        assert bad.json()["code"] == "invalid_driver_phone"
        denied = await client.get(f"{R}/driver/me", headers=_bearer(ana))
        assert denied.status_code == 403

    async def test_la_ubicacion_vieja_no_sale_en_el_mapa(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        await _driver(client, admin, "juan@moto.co")
        ana = await _register(client, "ana@correo.co")
        assert len((await client.get(f"{R}/drivers/live", headers=_bearer(ana))).json()) == 1
        clock.advance(minutes=3)
        assert (await client.get(f"{R}/drivers/live", headers=_bearer(ana))).json() == []


class TestViaje:
    async def test_viaje_completo(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        driver = await _driver(client, admin, "juan@moto.co")
        ana = await _register(client, "ana@correo.co")

        made = await client.post(R, json=PICKUP, headers=_bearer(ana))
        assert made.status_code == 201, made.text
        ride = made.json()
        assert ride["status"] == "requested" and ride["fare_cop"] == 5000
        again = await client.post(R, json=PICKUP, headers=_bearer(ana))
        assert again.json()["code"] == "active_ride_exists"

        nearby = (await client.get(f"{R}/driver/requests", headers=_bearer(driver))).json()
        assert [n["ride"]["id"] for n in nearby] == [ride["id"]]
        assert nearby[0]["ride"]["customer_phone"] == ""  # Aún no lo aceptó
        assert nearby[0]["eta_minutes"] >= 1

        accepted = await client.post(f"{R}/{ride['id']}/accept", headers=_bearer(driver))
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["customer_phone"] == "3001234567"
        assert "ride_accepted" in await _inbox(client, ana)

        current = (await client.get(f"{R}/current", headers=_bearer(ana))).json()
        assert current["status"] == "accepted"
        assert current["driver"]["name"] == "Juan Pérez"
        assert current["driver"]["plate_label"] == "NEI-123"
        assert current["driver"]["lat"] == TERMINAL["lat"]
        assert current["eta_minutes"] >= 1

        shared = await client.put(f"{R}/{ride['id']}/location", json=PLAZA, headers=_bearer(ana))
        assert shared.json()["customer_lat"] == PLAZA["lat"]
        seen = (await client.get(f"{R}/driver/current", headers=_bearer(driver))).json()
        assert seen["customer_lat"] == PLAZA["lat"]

        busy = (await client.get(f"{R}/drivers/live", headers=_bearer(ana))).json()
        assert busy[0]["busy"] is True

        await client.put(f"{R}/{ride['id']}/arrived", headers=_bearer(driver))
        assert "ride_arrived" in await _inbox(client, ana)
        cancelled = await client.put(f"{R}/{ride['id']}/cancel", headers=_bearer(ana))
        assert cancelled.status_code == 200

    async def test_terminar_cobrar_y_calificar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        driver = await _driver(client, admin, "juan@moto.co")
        ana = await _register(client, "ana@correo.co")
        ride = (await client.post(R, json={**PICKUP, "passengers": 3}, headers=_bearer(ana))).json()
        await client.post(f"{R}/{ride['id']}/accept", headers=_bearer(driver))
        early = await client.put(f"{R}/{ride['id']}/complete", headers=_bearer(driver))
        assert early.json()["code"] == "invalid_ride_transition"
        await client.put(f"{R}/{ride['id']}/start", headers=_bearer(driver))
        no_cancel = await client.put(f"{R}/{ride['id']}/cancel", headers=_bearer(ana))
        assert no_cancel.json()["code"] == "invalid_ride_transition"
        done = await client.put(f"{R}/{ride['id']}/complete", headers=_bearer(driver))
        assert done.json()["status"] == "completed"

        # Terminado y sin calificar: el cliente lo sigue viendo para darle la nota.
        current = (await client.get(f"{R}/current", headers=_bearer(ana))).json()
        assert current["status"] == "completed"
        rated = await client.put(
            f"{R}/{ride['id']}/rate", json={"stars": 5, "comment": "Muy amable"},
            headers=_bearer(ana),
        )  # fmt: skip
        assert rated.json()["driver"]["rating"] == 5
        assert (await client.get(f"{R}/current", headers=_bearer(ana))).json() is None

        earnings = (await client.get(f"{R}/driver/earnings", headers=_bearer(driver))).json()
        assert earnings["total_cop"] == 7500 and earnings["rides"] == 1
        assert earnings["passengers"] == 3 and earnings["fare_per_person_cop"] == 2500
        assert len(earnings["buckets"]) == 24
        assert sum(b["total_cop"] for b in earnings["buckets"]) == 7500
        week = (
            await client.get(f"{R}/driver/earnings?period=week", headers=_bearer(driver))
        ).json()
        assert len(week["buckets"]) == 7 and week["total_cop"] == 7500
        mine = (await client.get(f"{R}/mine", headers=_bearer(ana))).json()
        assert mine[0]["rating"] == 5


class TestReglas:
    async def test_un_cliente_a_la_vez_y_el_primero_gana(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        juan = await _driver(client, admin, "juan@moto.co")
        pedro = await _driver(client, admin, "pedro@moto.co")
        ana = await _register(client, "ana@correo.co")
        luis = await _register(client, "luis@correo.co")
        first = (await client.post(R, json=PICKUP, headers=_bearer(ana))).json()
        second = (await client.post(R, json=PICKUP, headers=_bearer(luis))).json()

        won = await client.post(f"{R}/{first['id']}/accept", headers=_bearer(juan))
        assert won.status_code == 200
        taken = await client.post(f"{R}/{first['id']}/accept", headers=_bearer(pedro))
        assert taken.json()["code"] == "ride_taken"
        busy = await client.post(f"{R}/{second['id']}/accept", headers=_bearer(juan))
        assert busy.json()["code"] == "driver_busy"
        other = await client.post(f"{R}/{second['id']}/accept", headers=_bearer(pedro))
        assert other.status_code == 200

    async def test_capacidad_disponibilidad_y_limites(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        juan = await _driver(client, admin, "juan@moto.co", online=False)
        ana = await _register(client, "ana@correo.co")
        four = await client.post(R, json={**PICKUP, "passengers": 4}, headers=_bearer(ana))
        assert four.status_code == 422
        outside = await client.post(R, json={**PICKUP, "lat": 4.6}, headers=_bearer(ana))
        assert outside.json()["code"] == "invalid_ride_location"

        ride = (await client.post(R, json={**PICKUP, "passengers": 3}, headers=_bearer(ana))).json()
        offline = await client.post(f"{R}/{ride['id']}/accept", headers=_bearer(juan))
        assert offline.json()["code"] == "driver_offline"
        await client.put(
            f"{R}/driver/me",
            json={"name": "Juan", "phone": "3101234567", "plate": "NEI123", "capacity": 2},
            headers=_bearer(juan),
        )
        await client.put(f"{R}/driver/status", json={"online": True}, headers=_bearer(juan))
        full = await client.post(f"{R}/{ride['id']}/accept", headers=_bearer(juan))
        assert full.json()["code"] == "too_many_passengers"

    async def test_la_solicitud_se_vence_y_el_conductor_puede_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        juan = await _driver(client, admin, "juan@moto.co")
        ana = await _register(client, "ana@correo.co")
        ride = (await client.post(R, json=PICKUP, headers=_bearer(ana))).json()
        clock.advance(minutes=16)
        ana = await _login(client, "ana@correo.co")
        juan = await _login(client, "juan@moto.co")
        current = (await client.get(f"{R}/current", headers=_bearer(ana))).json()
        assert current["status"] == "expired"
        assert (await client.get(f"{R}/driver/requests", headers=_bearer(juan))).json() == []
        late = await client.post(f"{R}/{ride['id']}/accept", headers=_bearer(juan))
        assert late.json()["code"] == "ride_taken"

        new = (await client.post(R, json=PICKUP, headers=_bearer(ana))).json()
        await client.put(f"{R}/driver/location", json=TERMINAL, headers=_bearer(juan))
        await client.post(f"{R}/{new['id']}/accept", headers=_bearer(juan))
        dropped = await client.put(f"{R}/{new['id']}/cancel", headers=_bearer(juan))
        assert dropped.json()["cancelled_by"] == "driver"
        assert "ride_cancelled" in await _inbox(client, ana)
        stranger = await _register(client, "luis@correo.co")
        assert (await client.get(f"{R}/{new['id']}", headers=_bearer(stranger))).status_code == 403
