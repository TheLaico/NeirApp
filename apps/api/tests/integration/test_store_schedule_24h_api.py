"""Opción 24/7: tienda abierta todos los días, las 24 horas.

El reloj de los tests arranca el lunes 21/sep/2026 a las 07:00 en Colombia.
"""

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_reviews_api import API, _bearer, _register
from tests.integration.test_store_schedule_api import _order, _store, week

ALL_DAY = {"days": [{"weekday": d, "is_open": True, "all_day": True} for d in range(7)]}


async def test_24_7_se_guarda_y_se_consulta(client: httpx.AsyncClient, app: FastAPI) -> None:
    store, owner = await _store(client, app)
    url = f"{API}/stores/{store['id']}/schedule"

    put = await client.put(url, json=ALL_DAY, headers=_bearer(owner))

    assert put.status_code == 200, put.text
    body = (await client.get(url)).json()
    assert body["is_24_7"] is True and body["has_hours"] is True
    assert body["days"][0] == {
        "weekday": 0,
        "is_open": True,
        "opens": None,
        "closes": None,
        "all_day": True,
    }
    assert body["is_open"] is True  # 07:00: un horario normal la habría tenido cerrada


async def test_abierta_a_cualquier_hora_y_recibe_pedidos_de_madrugada(
    client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
) -> None:
    store, owner = await _store(client, app)
    await _register(client, "cliente@correo.com")
    await client.put(f"{API}/stores/{store['id']}/schedule", json=ALL_DAY, headers=_bearer(owner))

    clock.advance(hours=20)  # martes 03:00 en Colombia
    early = (await client.get(f"{API}/stores/{store['id']}")).json()
    order = await _order(client, store["id"])

    assert early["is_open"] is True
    assert order.status_code == 201, order.text


async def test_el_interruptor_manual_y_los_dias_marcados_siguen_cerrando_en_24_7(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    store, owner = await _store(client, app)
    base = f"{API}/stores/{store['id']}"
    await client.put(f"{base}/schedule", json=ALL_DAY, headers=_bearer(owner))

    await client.post(f"{base}/closed-dates", json={"day": "2026-09-21"}, headers=_bearer(owner))
    marked = (await client.get(base)).json()
    await client.delete(f"{base}/closed-dates/2026-09-21", headers=_bearer(owner))
    await client.patch(f"{base}/open", json={"is_open": False}, headers=_bearer(owner))
    manual = (await client.get(base)).json()

    assert marked["is_open"] is False and marked["closed_reason"] == "closed_date"
    assert manual["is_open"] is False and manual["closed_reason"] == "manual"


async def test_volver_a_un_horario_normal_quita_el_24_7(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    store, owner = await _store(client, app)
    url = f"{API}/stores/{store['id']}/schedule"
    await client.put(url, json=ALL_DAY, headers=_bearer(owner))

    normal = await client.put(url, json=week(), headers=_bearer(owner))

    assert normal.json()["is_24_7"] is False
    assert normal.json()["days"][0]["all_day"] is False
    assert normal.json()["is_open"] is False  # 07:00 con horario de 8 a 20


async def test_un_dia_de_24_horas_dentro_de_un_horario_normal(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    store, owner = await _store(client, app)
    days = week()["days"]
    days[0] = {"weekday": 0, "is_open": True, "all_day": True}  # el lunes, todo el día
    url = f"{API}/stores/{store['id']}/schedule"

    put = await client.put(url, json={"days": days}, headers=_bearer(owner))

    assert put.status_code == 200, put.text
    assert put.json()["is_24_7"] is False
    assert put.json()["is_open"] is True  # lunes 07:00
