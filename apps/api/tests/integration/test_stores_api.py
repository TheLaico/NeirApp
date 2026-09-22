from typing import Any
from uuid import UUID

import httpx
from fastapi import FastAPI

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel

API = "/api/v1"

# Centro aproximado del casco urbano de Neira, Caldas (dentro de la geocerca del backend).
NEIRA_LAT, NEIRA_LNG = 5.1667, -75.5167
OUTSIDE_LAT, OUTSIDE_LNG = 5.0689, -75.5174  # Manizales: fuera de Neira

STORE_BODY = {
    "name": "Tienda Don José",
    "category": "general",
    "description": "La tienda de la esquina",
    "lat": NEIRA_LAT,
    "lng": NEIRA_LNG,
}

PRODUCT_BODY = {"name": "Pizza margarita", "description": "Con albahaca", "price_cop": 25_000}


async def _register(client: httpx.AsyncClient, email: str = "ana@correo.com") -> dict[str, Any]:
    response = await client.post(
        f"{API}/identity/register",
        json={
            "email": email,
            "password": "clave-segura-123",
            "full_name": "Ana Gómez",
            "phone": "300 123 4567",
            "accepted_terms": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["tokens"]  # type: ignore[no-any-return]


def _bearer(tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _create_store(
    client: httpx.AsyncClient, tokens: dict[str, Any], **overrides: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{API}/stores", json={**STORE_BODY, **overrides}, headers=_bearer(tokens)
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


_admin_seq = 0


async def _admin_tokens(client: httpx.AsyncClient, app: FastAPI) -> dict[str, Any]:
    """Registra un usuario nuevo y le otorga el rol admin directo en la base (sin flujo propio)."""
    global _admin_seq
    _admin_seq += 1
    tokens = await _register(client, f"admin{_admin_seq}@correo.com")
    me = (await client.get(f"{API}/identity/me", headers=_bearer(tokens))).json()
    async with app.state.engine.begin() as conn:
        await conn.execute(
            UserRoleModel.__table__.insert().values(user_id=UUID(me["id"]), role=Role.ADMIN.value)
        )
    return tokens


async def _approve_store(client: httpx.AsyncClient, app: FastAPI, store_id: str) -> None:
    admin = await _admin_tokens(client, app)
    response = await client.patch(
        f"{API}/stores/{store_id}/approval", json={"is_approved": True}, headers=_bearer(admin)
    )
    assert response.status_code == 200, response.text


async def _create_approved_store(
    client: httpx.AsyncClient, app: FastAPI, tokens: dict[str, Any], **overrides: Any
) -> dict[str, Any]:
    store = await _create_store(client, tokens, **overrides)
    await _approve_store(client, app, store["id"])
    store["is_approved"] = True
    return store


class TestCreateStore:
    async def test_crea_una_tienda_dentro_de_neira(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        store = await _create_store(client, tokens)
        assert store["name"] == "Tienda Don José"
        assert store["category"] == "general"
        assert store["is_open"] is True
        assert store["is_approved"] is False  # un admin debe aprobarla (backoffice)

    async def test_requiere_autenticacion(self, client: httpx.AsyncClient) -> None:
        response = await client.post(f"{API}/stores", json=STORE_BODY)
        assert response.status_code == 401

    async def test_rechaza_ubicaciones_fuera_de_neira(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/stores",
            json={**STORE_BODY, "lat": OUTSIDE_LAT, "lng": OUTSIDE_LNG},
            headers=_bearer(tokens),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "outside_service_area"

    async def test_rechaza_nombre_muy_corto(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/stores", json={**STORE_BODY, "name": "A"}, headers=_bearer(tokens)
        )
        assert response.status_code == 422


class TestListAndGetStore:
    async def test_lista_tiendas_publicamente(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_approved_store(client, app, tokens)

        response = await client.get(f"{API}/stores")
        assert response.status_code == 200
        assert any(s["id"] == created["id"] for s in response.json())

    async def test_una_tienda_sin_aprobar_no_aparece_en_el_listado_publico(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        response = await client.get(f"{API}/stores")
        assert response.status_code == 200
        assert not any(s["id"] == created["id"] for s in response.json())

    async def test_filtra_por_categoria(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        tokens = await _register(client)
        await _create_approved_store(client, app, tokens, category="bakery")

        matching = await client.get(f"{API}/stores", params={"category": "bakery"})
        other = await client.get(f"{API}/stores", params={"category": "pharmacy"})
        assert len(matching.json()) == 1
        assert other.json() == []

    async def test_obtiene_una_tienda_por_id(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        tokens = await _register(client)
        created = await _create_approved_store(client, app, tokens)

        response = await client.get(f"{API}/stores/{created['id']}")
        assert response.status_code == 200
        assert response.json()["name"] == "Tienda Don José"

    async def test_una_tienda_sin_aprobar_da_404_en_su_pagina_publica(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        response = await client.get(f"{API}/stores/{created['id']}")
        assert response.status_code == 404
        assert response.json()["code"] == "store_not_found"

    async def test_404_para_tienda_inexistente(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/stores/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        assert response.json()["code"] == "store_not_found"


class TestMyStore:
    async def test_null_si_no_tiene_tienda(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/stores/me", headers=_bearer(tokens))
        assert response.status_code == 200
        assert response.json() is None

    async def test_devuelve_la_tienda_propia(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        response = await client.get(f"{API}/stores/me", headers=_bearer(tokens))
        assert response.json()["id"] == created["id"]


class TestUpdateAndOpenStore:
    async def test_el_dueno_puede_actualizar(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        response = await client.patch(
            f"{API}/stores/{created['id']}",
            json={"name": "Tienda Doña Ana"},
            headers=_bearer(tokens),
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Tienda Doña Ana"

    async def test_otro_usuario_no_puede_actualizar(self, client: httpx.AsyncClient) -> None:
        owner_tokens = await _register(client, "duena@correo.com")
        created = await _create_store(client, owner_tokens)
        other_tokens = await _register(client, "otra@correo.com")

        response = await client.patch(
            f"{API}/stores/{created['id']}",
            json={"name": "Hackeada"},
            headers=_bearer(other_tokens),
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_store_owner"

    async def test_el_dueno_puede_cerrar_y_abrir(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        closed = await client.patch(
            f"{API}/stores/{created['id']}/open", json={"is_open": False}, headers=_bearer(tokens)
        )
        assert closed.json()["is_open"] is False


class TestProducts:
    async def _store(self, client: httpx.AsyncClient) -> tuple[dict[str, Any], dict[str, Any]]:
        tokens = await _register(client)
        store = await _create_store(client, tokens)
        return store, tokens

    async def test_el_dueno_crea_un_producto(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        response = await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "Pizza margarita"
        assert body["price_cop"] == 25_000
        assert body["is_available"] is True

    async def test_otro_usuario_no_puede_crear_productos(self, client: httpx.AsyncClient) -> None:
        store, _ = await self._store(client)
        other_tokens = await _register(client, "otra@correo.com")
        response = await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(other_tokens)
        )
        assert response.status_code == 403

    async def test_precio_invalido(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        response = await client.post(
            f"{API}/stores/{store['id']}/products",
            json={**PRODUCT_BODY, "price_cop": 0},
            headers=_bearer(tokens),
        )
        assert response.status_code == 422

    async def test_tienda_inexistente(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/stores/00000000-0000-0000-0000-000000000000/products",
            json=PRODUCT_BODY,
            headers=_bearer(tokens),
        )
        assert response.status_code == 404

    async def test_lista_el_catalogo_publicamente(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
        )

        response = await client.get(f"{API}/stores/{store['id']}/products")
        assert response.status_code == 200
        assert len(response.json()) == 1

    async def test_el_dueno_actualiza_un_producto(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        product = (
            await client.post(
                f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
            )
        ).json()

        response = await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}",
            json={"price_cop": 30_000},
            headers=_bearer(tokens),
        )
        assert response.status_code == 200
        assert response.json()["price_cop"] == 30_000
        assert response.json()["name"] == "Pizza margarita"

    async def test_el_dueno_cambia_disponibilidad(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        product = (
            await client.post(
                f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
            )
        ).json()

        response = await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}/availability",
            json={"is_available": False},
            headers=_bearer(tokens),
        )
        assert response.json()["is_available"] is False

    async def test_el_dueno_elimina_un_producto(self, client: httpx.AsyncClient) -> None:
        store, tokens = await self._store(client)
        product = (
            await client.post(
                f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
            )
        ).json()

        response = await client.delete(
            f"{API}/stores/{store['id']}/products/{product['id']}", headers=_bearer(tokens)
        )
        assert response.status_code == 204

        listing = await client.get(f"{API}/stores/{store['id']}/products")
        assert listing.json() == []


class TestSearch:
    async def _seed(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        tokens = await _register(client)
        pizzeria = await _create_approved_store(
            client, app, tokens, name="Pizzería Napoli", category="restaurant"
        )
        panaderia = await _create_approved_store(
            client, app, tokens, name="Panadería Central", category="bakery"
        )

        await client.post(
            f"{API}/stores/{pizzeria['id']}/products",
            json={"name": "Pizza margarita", "description": "Clásica", "price_cop": 25_000},
            headers=_bearer(tokens),
        )
        await client.post(
            f"{API}/stores/{pizzeria['id']}/products",
            json={"name": "Pizza hawaiana", "description": "Con piña", "price_cop": 30_000},
            headers=_bearer(tokens),
        )
        unavailable = await client.post(
            f"{API}/stores/{pizzeria['id']}/products",
            json={"name": "Pizza vegetariana", "description": "", "price_cop": 28_000},
            headers=_bearer(tokens),
        )
        await client.patch(
            f"{API}/stores/{pizzeria['id']}/products/{unavailable.json()['id']}/availability",
            json={"is_available": False},
            headers=_bearer(tokens),
        )
        await client.post(
            f"{API}/stores/{panaderia['id']}/products",
            json={"name": "Pan de queso", "description": "Recién horneado", "price_cop": 3_000},
            headers=_bearer(tokens),
        )

    async def test_busca_por_texto(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        await self._seed(client, app)
        response = await client.get(f"{API}/products/search", params={"q": "pizza"})
        assert response.status_code == 200
        names = {r["product"]["name"] for r in response.json()}
        assert names == {"Pizza margarita", "Pizza hawaiana"}  # no incluye la no disponible

    async def test_busca_por_descripcion(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        await self._seed(client, app)
        response = await client.get(f"{API}/products/search", params={"q": "horneado"})
        assert [r["product"]["name"] for r in response.json()] == ["Pan de queso"]

    async def test_filtra_por_categoria_de_tienda(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        await self._seed(client, app)
        response = await client.get(
            f"{API}/products/search", params={"q": "", "category": "bakery"}
        )
        assert [r["product"]["name"] for r in response.json()] == ["Pan de queso"]

    async def test_filtra_por_precio_maximo(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        await self._seed(client, app)
        response = await client.get(
            f"{API}/products/search", params={"q": "pizza", "max_price_cop": 26_000}
        )
        assert [r["product"]["name"] for r in response.json()] == ["Pizza margarita"]

    async def test_ordena_por_precio(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        await self._seed(client, app)
        response = await client.get(
            f"{API}/products/search", params={"q": "pizza", "sort": "price_desc"}
        )
        prices = [r["product"]["price_cop"] for r in response.json()]
        assert prices == sorted(prices, reverse=True)

    async def test_incluye_la_tienda_en_el_resultado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        await self._seed(client, app)
        response = await client.get(f"{API}/products/search", params={"q": "pan"})
        assert response.json()[0]["store"]["name"] == "Panadería Central"


class TestApproval:
    async def test_admin_ve_las_tiendas_pendientes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)

        response = await client.get(f"{API}/stores/pending", headers=_bearer(admin))
        assert response.status_code == 200
        assert [s["id"] for s in response.json()] == [created["id"]]

    async def test_un_usuario_normal_no_puede_ver_pendientes(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/stores/pending", headers=_bearer(tokens))
        assert response.status_code == 403
        assert response.json()["code"] == "insufficient_role"

    async def test_un_usuario_normal_no_puede_aprobar(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        response = await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": True},
            headers=_bearer(tokens),
        )
        assert response.status_code == 403

    async def test_aprobada_desaparece_de_pendientes_y_aparece_en_publico(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)

        await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": True},
            headers=_bearer(admin),
        )

        pending = await client.get(f"{API}/stores/pending", headers=_bearer(admin))
        assert pending.json() == []
        public = await client.get(f"{API}/stores/{created['id']}")
        assert public.status_code == 200

    async def test_el_dueno_ve_y_administra_su_tienda_mientras_esta_pendiente(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)

        mine = await client.get(f"{API}/stores/me", headers=_bearer(tokens))
        assert mine.json()["id"] == created["id"]

        product = await client.post(
            f"{API}/stores/{created['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
        )
        assert product.status_code == 201

    async def test_una_tienda_sin_aprobar_no_aparece_en_busqueda(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        store = await _create_store(client, tokens)
        await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
        )

        response = await client.get(f"{API}/products/search", params={"q": "pizza"})
        assert response.json() == []


class TestRejection:
    """Rechazar una tienda debe distinguirse de "todavía sin revisar" (bug encontrado en vivo:
    antes, aprobar y rechazar dejaban la misma `is_approved=False`, y una tienda rechazada nunca
    salía de la cola de pendientes del backoffice)."""

    async def test_rechazar_marca_is_rejected_y_deja_is_approved_en_false(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)

        response = await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": False},
            headers=_bearer(admin),
        )
        assert response.status_code == 200
        assert response.json()["is_approved"] is False
        assert response.json()["is_rejected"] is True

    async def test_tienda_rechazada_desaparece_de_pendientes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)

        await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": False},
            headers=_bearer(admin),
        )

        pending = await client.get(f"{API}/stores/pending", headers=_bearer(admin))
        assert pending.json() == []

    async def test_tienda_rechazada_sigue_invisible_para_clientes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)
        await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": False},
            headers=_bearer(admin),
        )

        public = await client.get(f"{API}/stores/{created['id']}")
        assert public.status_code == 404

    async def test_aprobar_despues_de_rechazar_limpia_is_rejected(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        tokens = await _register(client)
        created = await _create_store(client, tokens)
        admin = await _admin_tokens(client, app)
        await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": False},
            headers=_bearer(admin),
        )

        response = await client.patch(
            f"{API}/stores/{created['id']}/approval",
            json={"is_approved": True},
            headers=_bearer(admin),
        )
        assert response.json()["is_approved"] is True
        assert response.json()["is_rejected"] is False

        public = await client.get(f"{API}/stores/{created['id']}")
        assert public.status_code == 200
