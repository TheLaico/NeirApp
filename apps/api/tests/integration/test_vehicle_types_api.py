import httpx
from fastapi import FastAPI

from tests.integration.test_dispatch_api import API, _admin_tokens, _bearer, _register

BODY = {"plate": "ABC123", "id_document_number": "123456789"}
URL = f"{API}/couriers/vehicle-types"


async def _enabled(client: httpx.AsyncClient, tokens: dict) -> dict[str, bool]:  # type: ignore[type-arg]
    response = await client.get(URL, headers=_bearer(tokens))
    assert response.status_code == 200
    return {v["vehicle_type"]: v["is_enabled"] for v in response.json()}


async def test_por_defecto_solo_moto_esta_habilitada(client: httpx.AsyncClient) -> None:
    tokens = await _register(client)

    assert await _enabled(client, tokens) == {
        "bike": False,
        "motorcycle": True,
        "car": False,
        "motocarro": False,
    }


async def test_solo_moto_puede_registrarse_al_inicio(client: httpx.AsyncClient) -> None:
    tokens = await _register(client)

    for vehicle in ("bike", "car", "motocarro"):
        response = await client.post(
            f"{API}/couriers/me", json={**BODY, "vehicle_type": vehicle}, headers=_bearer(tokens)
        )
        assert response.status_code == 422, vehicle
        assert response.json()["code"] == "vehicle_type_not_enabled"

    moto = await client.post(
        f"{API}/couriers/me", json={**BODY, "vehicle_type": "motorcycle"}, headers=_bearer(tokens)
    )
    assert moto.status_code == 201


async def test_admin_habilita_motocarro_y_ya_se_puede_registrar(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    tokens = await _register(client, "motocarro@correo.com")

    updated = await client.put(
        f"{URL}/motocarro", json={"is_enabled": True}, headers=_bearer(admin)
    )
    assert updated.status_code == 200
    assert {v["vehicle_type"]: v["is_enabled"] for v in updated.json()}["motocarro"] is True

    created = await client.post(
        f"{API}/couriers/me", json={**BODY, "vehicle_type": "motocarro"}, headers=_bearer(tokens)
    )
    assert created.status_code == 201
    assert created.json()["vehicle_type"] == "motocarro"


async def test_admin_puede_deshabilitar_moto(client: httpx.AsyncClient, app: FastAPI) -> None:
    admin = await _admin_tokens(client, app)
    tokens = await _register(client, "moto@correo.com")

    await client.put(f"{URL}/motorcycle", json={"is_enabled": False}, headers=_bearer(admin))

    assert (await _enabled(client, tokens))["motorcycle"] is False
    blocked = await client.post(
        f"{API}/couriers/me", json={**BODY, "vehicle_type": "motorcycle"}, headers=_bearer(tokens)
    )
    assert blocked.status_code == 422


async def test_solo_admin_cambia_los_vehiculos(client: httpx.AsyncClient) -> None:
    tokens = await _register(client)

    response = await client.put(f"{URL}/car", json={"is_enabled": True}, headers=_bearer(tokens))

    assert response.status_code == 403
    assert (await client.get(URL)).status_code == 401
