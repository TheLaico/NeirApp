"""Horario de apertura y fechas de cierre, y su efecto sobre lo que ven y pueden hacer los clientes.

El reloj de los tests arranca el lunes 21/sep/2026 a las 12:00 UTC = 07:00 en Colombia.
"""

from typing import Any

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_reviews_api import (
    API,
    NEIRA_LAT,
    NEIRA_LNG,
    PRODUCT_BODY,
    STORE_BODY,
    _admin_tokens,
    _bearer,
    _register,
)


def week(opens: str = "08:00", closes: str = "20:00", off: tuple[int, ...] = ()) -> dict[str, Any]:
    return {
        "days": [
            {"weekday": d, "is_open": False}
            if d in off
            else {"weekday": d, "is_open": True, "opens": opens, "closes": closes}
            for d in range(7)
        ]
    }


async def _store(client: httpx.AsyncClient, app: FastAPI) -> tuple[dict[str, Any], dict[str, Any]]:
    """Tienda aprobada con un producto. Devuelve (tienda, tokens del dueño)."""
    admin = await _admin_tokens(client, app)
    owner = await _register(client, "duena@correo.com")
    store = (await client.post(f"{API}/stores", json=STORE_BODY, headers=_bearer(owner))).json()
    await client.patch(
        f"{API}/stores/{store['id']}/approval", json={"is_approved": True}, headers=_bearer(admin)
    )
    await client.post(
        f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(owner)
    )
    return store, owner


async def _order(client: httpx.AsyncClient, store_id: str) -> httpx.Response:
    products = (await client.get(f"{API}/stores/{store_id}/products")).json()
    login = await client.post(
        f"{API}/identity/login",
        json={"email": "cliente@correo.com", "password": "clave-segura-123"},
    )
    tokens = login.json()["tokens"]
    return await client.post(
        f"{API}/orders",
        json={
            "delivery_lat": NEIRA_LAT,
            "delivery_lng": NEIRA_LNG,
            "delivery_notes": "",
            "items": [{"store_id": store_id, "product_id": products[0]["id"], "quantity": 1}],
        },
        headers=_bearer(tokens),
    )


class TestHorarioSemanal:
    async def test_el_dueno_define_su_horario_y_cualquiera_lo_consulta(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await _store(client, app)
        url = f"{API}/stores/{store['id']}/schedule"

        before = (await client.get(url)).json()
        assert before["has_hours"] is False and before["is_open"] is True

        put = await client.put(url, json=week(off=(6,)), headers=_bearer(owner))

        assert put.status_code == 200, put.text
        body = (await client.get(url)).json()  # público, sin sesión
        assert body["has_hours"] is True
        assert body["timezone"] == "America/Bogota"
        assert len(body["days"]) == 7
        assert body["days"][0] == {
            "weekday": 0,
            "is_open": True,
            "opens": "08:00:00",
            "closes": "20:00:00",
            "all_day": False,
        }
        assert body["days"][6]["is_open"] is False

    async def test_estado_ahora_segun_la_hora_de_colombia(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        store, owner = await _store(client, app)
        await client.put(
            f"{API}/stores/{store['id']}/schedule", json=week(), headers=_bearer(owner)
        )

        # Lunes 07:00 → todavía no abre.
        early = (await client.get(f"{API}/stores/{store['id']}")).json()
        assert early["is_open"] is False
        assert early["closed_reason"] == "outside_hours"
        assert early["is_open_manual"] is True
        assert early["next_open_at"].startswith("2026-09-21T08:00:00")

        clock.advance(hours=2)  # 09:00
        assert (await client.get(f"{API}/stores/{store['id']}")).json()["is_open"] is True

        clock.advance(hours=12)  # 21:00
        late = (await client.get(f"{API}/stores/{store['id']}")).json()
        assert late["is_open"] is False
        assert late["next_open_at"].startswith("2026-09-22T08:00:00")

    async def test_el_interruptor_manual_sigue_cerrando(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        store, owner = await _store(client, app)
        await client.put(
            f"{API}/stores/{store['id']}/schedule", json=week(), headers=_bearer(owner)
        )
        clock.advance(hours=2)  # 09:00, dentro de horario (el token de antes ya venció)
        owner = (
            await client.post(
                f"{API}/identity/login",
                json={"email": "duena@correo.com", "password": "clave-segura-123"},
            )
        ).json()["tokens"]

        patched = await client.patch(
            f"{API}/stores/{store['id']}/open", json={"is_open": False}, headers=_bearer(owner)
        )
        assert patched.status_code == 200, patched.text

        body = (await client.get(f"{API}/stores/{store['id']}")).json()
        assert body["is_open"] is False and body["closed_reason"] == "manual"

    async def test_quitar_el_horario_devuelve_a_solo_interruptor(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await _store(client, app)
        url = f"{API}/stores/{store['id']}/schedule"
        await client.put(url, json=week(), headers=_bearer(owner))  # 07:00 → cerrada

        cleared = await client.delete(url, headers=_bearer(owner))

        assert cleared.json()["has_hours"] is False
        assert cleared.json()["is_open"] is True

    async def test_horarios_invalidos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, owner = await _store(client, app)
        url = f"{API}/stores/{store['id']}/schedule"

        invertido = await client.put(url, json=week("20:00", "08:00"), headers=_bearer(owner))
        incompleto = await client.put(
            url, json={"days": week()["days"][:6]}, headers=_bearer(owner)
        )
        repetido = await client.put(
            url, json={"days": [week()["days"][0]] * 7}, headers=_bearer(owner)
        )

        assert invertido.status_code == 422 and invertido.json()["code"] == "invalid_schedule"
        assert incompleto.status_code == 422
        assert repetido.status_code == 422 and repetido.json()["code"] == "invalid_schedule"

    async def test_solo_el_dueno_cambia_el_horario(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, _owner = await _store(client, app)
        intruder = await _register(client, "intruso@correo.com")
        url = f"{API}/stores/{store['id']}/schedule"

        assert (await client.put(url, json=week(), headers=_bearer(intruder))).status_code == 403
        assert (await client.delete(url, headers=_bearer(intruder))).status_code == 403
        assert (await client.put(url, json=week())).status_code == 401


class TestDiasSinAtencion:
    async def test_marcar_y_quitar_un_dia_en_que_no_abre(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await _store(client, app)
        base = f"{API}/stores/{store['id']}"
        assert (await client.get(base)).json()["is_open"] is True

        added = await client.post(
            f"{base}/closed-dates",
            json={"day": "2026-09-21", "reason": "  Día de   descanso "},
            headers=_bearer(owner),
        )

        assert added.status_code == 201, added.text
        assert added.json()["closed_dates"] == [{"day": "2026-09-21", "reason": "Día de descanso"}]
        hoy = (await client.get(base)).json()
        assert hoy["is_open"] is False and hoy["closed_reason"] == "closed_date"

        removed = await client.delete(f"{base}/closed-dates/2026-09-21", headers=_bearer(owner))
        assert removed.json()["closed_dates"] == []
        assert (await client.get(base)).json()["is_open"] is True

    async def test_un_cierre_futuro_no_afecta_hoy_y_las_fechas_pasadas_no_se_listan(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        store, owner = await _store(client, app)
        base = f"{API}/stores/{store['id']}"
        await client.post(
            f"{base}/closed-dates", json={"day": "2026-09-22"}, headers=_bearer(owner)
        )

        assert (await client.get(base)).json()["is_open"] is True  # hoy es 21

        clock.advance(days=2)  # pasó el 22
        assert (await client.get(f"{base}/schedule")).json()["closed_dates"] == []

    async def test_no_acepta_fechas_pasadas_ni_motivos_larguisimos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await _store(client, app)
        url = f"{API}/stores/{store['id']}/closed-dates"

        pasada = await client.post(url, json={"day": "2026-09-20"}, headers=_bearer(owner))
        larga = await client.post(
            url, json={"day": "2026-09-25", "reason": "x" * 121}, headers=_bearer(owner)
        )

        assert pasada.status_code == 422 and pasada.json()["code"] == "invalid_closed_date"
        assert larga.status_code == 422

    async def test_solo_el_dueno_marca_dias(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, _owner = await _store(client, app)
        intruder = await _register(client, "intruso@correo.com")

        response = await client.post(
            f"{API}/stores/{store['id']}/closed-dates",
            json={"day": "2026-09-25"},
            headers=_bearer(intruder),
        )

        assert response.status_code == 403


class TestPedidosYHorario:
    async def _setup(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        store, owner = await _store(client, app)
        await _register(client, "cliente@correo.com")
        return store, owner

    async def test_no_se_puede_pedir_fuera_de_horario_y_si_dentro(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        store, owner = await self._setup(client, app)
        await client.put(
            f"{API}/stores/{store['id']}/schedule", json=week(), headers=_bearer(owner)
        )

        cerrada = await _order(client, store["id"])  # 07:00
        assert cerrada.status_code == 422
        assert cerrada.json()["code"] == "store_unavailable_for_order"

        clock.advance(hours=2)  # 09:00
        abierta = await _order(client, store["id"])
        assert abierta.status_code == 201, abierta.text

    async def test_no_se_puede_pedir_en_un_dia_de_cierre(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await self._setup(client, app)
        await client.post(
            f"{API}/stores/{store['id']}/closed-dates",
            json={"day": "2026-09-21"},
            headers=_bearer(owner),
        )

        response = await _order(client, store["id"])

        assert response.status_code == 422
        assert response.json()["code"] == "store_unavailable_for_order"

    async def test_la_busqueda_de_productos_tambien_muestra_el_estado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, owner = await self._setup(client, app)
        await client.put(
            f"{API}/stores/{store['id']}/schedule", json=week(), headers=_bearer(owner)
        )

        found = await client.get(f"{API}/products/search", params={"q": "pizza"})

        assert found.status_code == 200, found.text
        assert found.json()[0]["store"]["is_open"] is False
        assert found.json()[0]["store"]["closed_reason"] == "outside_hours"
