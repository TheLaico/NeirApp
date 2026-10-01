import httpx
from fastapi import FastAPI

from tests.integration.test_dispatch_api import API, _admin_tokens, _bearer, _register

STORE = {
    "name": "Panadería El Trigal",
    "category": "bakery",
    "description": "",
    "lat": 5.1667,
    "lng": -75.5167,
}
URL = f"{API}/admin/stores"


async def _merchant(client: httpx.AsyncClient, admin: dict, email: str) -> None:  # type: ignore[type-arg]
    await _register(client, email)
    granted = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "store_staff"},
        headers=_bearer(admin),
    )
    assert granted.status_code == 201


async def test_admin_crea_tienda_aprobada_para_un_comerciante(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    await _merchant(client, admin, "duena@correo.com")

    created = await client.post(
        URL, json={**STORE, "owner_email": " Duena@Correo.com "}, headers=_bearer(admin)
    )

    assert created.status_code == 201, created.text
    assert created.json()["is_approved"] is True
    # Ya es visible para los clientes y es la tienda de ese comerciante.
    assert (await client.get(f"{API}/stores/{created.json()['id']}")).status_code == 200
    owner = (
        await client.post(
            f"{API}/identity/login",
            json={"email": "duena@correo.com", "password": "clave-segura-123"},
        )
    ).json()["tokens"]
    mine = await client.get(f"{API}/stores/me", headers=_bearer(owner))
    assert mine.json()["id"] == created.json()["id"]


async def test_exige_que_el_correo_tenga_cuenta_y_rol_de_comerciante(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    await _register(client, "cliente@correo.com")  # cuenta, pero sin rol de comerciante

    sin_cuenta = await client.post(
        URL, json={**STORE, "owner_email": "nadie@correo.com"}, headers=_bearer(admin)
    )
    sin_rol = await client.post(
        URL, json={**STORE, "owner_email": "cliente@correo.com"}, headers=_bearer(admin)
    )

    assert sin_cuenta.json()["code"] == "store_owner_not_registered"
    assert sin_rol.json()["code"] == "store_owner_not_merchant"


async def test_un_comerciante_solo_puede_tener_una_tienda(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    await _merchant(client, admin, "duena@correo.com")
    body = {**STORE, "owner_email": "duena@correo.com"}

    await client.post(URL, json=body, headers=_bearer(admin))
    second = await client.post(URL, json=body, headers=_bearer(admin))

    assert second.status_code == 422
    assert second.json()["code"] == "owner_already_has_store"


async def test_solo_admin_puede_crear_tiendas_para_otros(client: httpx.AsyncClient) -> None:
    tokens = await _register(client)

    response = await client.post(
        URL, json={**STORE, "owner_email": "x@correo.com"}, headers=_bearer(tokens)
    )

    assert response.status_code == 403


async def _create(
    client: httpx.AsyncClient,
    admin: dict,
    email: str,
    name: str = "Panadería El Trigal",  # type: ignore[type-arg]
) -> dict:  # type: ignore[type-arg]
    await _merchant(client, admin, email)
    created = await client.post(
        URL, json={**STORE, "name": name, "owner_email": email}, headers=_bearer(admin)
    )
    assert created.status_code == 201, created.text
    return created.json()  # type: ignore[no-any-return]


async def test_admin_lista_todas_las_tiendas_con_el_correo_del_dueno(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    await _create(client, admin, "duena@correo.com")

    listing = await client.get(URL, headers=_bearer(admin))

    assert listing.status_code == 200
    assert [(s["name"], s["owner_email"], s["is_listed"]) for s in listing.json()] == [
        ("Panadería El Trigal", "duena@correo.com", True)
    ]
    assert (
        await client.get(URL, headers=_bearer(await _register(client, "x@correo.com")))
    ).status_code == 403


async def test_admin_oculta_y_vuelve_a_mostrar_una_tienda(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin_tokens(client, app)
    store = await _create(client, admin, "duena@correo.com")
    url = f"{URL}/{store['id']}"

    hidden = await client.patch(url, json={"is_listed": False}, headers=_bearer(admin))
    assert hidden.json()["is_listed"] is False
    # Fuera del mapa, de su página y de la búsqueda; el admin sí la sigue viendo.
    assert (await client.get(f"{API}/stores")).json() == []
    assert (await client.get(f"{API}/stores/{store['id']}")).status_code == 404
    assert len((await client.get(URL, headers=_bearer(admin))).json()) == 1

    shown = await client.patch(url, json={"is_listed": True}, headers=_bearer(admin))
    assert shown.json()["is_listed"] is True
    assert len((await client.get(f"{API}/stores")).json()) == 1


async def test_admin_cambia_la_posicion(client: httpx.AsyncClient, app: FastAPI) -> None:
    admin = await _admin_tokens(client, app)
    store = await _create(client, admin, "duena@correo.com")
    url = f"{URL}/{store['id']}"

    moved = await client.patch(url, json={"lat": 5.17, "lng": -75.52}, headers=_bearer(admin))
    assert (moved.json()["lat"], moved.json()["lng"]) == (5.17, -75.52)

    outside = await client.patch(url, json={"lat": 5.0689, "lng": -75.5174}, headers=_bearer(admin))
    assert outside.json()["code"] == "outside_service_area"
    half = await client.patch(url, json={"lat": 5.17}, headers=_bearer(admin))
    assert half.json()["code"] == "invalid_store_position"


async def test_admin_cambia_el_dueno_por_correo(client: httpx.AsyncClient, app: FastAPI) -> None:
    admin = await _admin_tokens(client, app)
    store = await _create(client, admin, "duena@correo.com")
    await _merchant(client, admin, "nuevo@correo.com")
    url = f"{URL}/{store['id']}"

    changed = await client.patch(
        url, json={"owner_email": " Nuevo@Correo.com "}, headers=_bearer(admin)
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["owner_email"] == "nuevo@correo.com"

    new_owner = (
        await client.post(
            f"{API}/identity/login",
            json={"email": "nuevo@correo.com", "password": "clave-segura-123"},
        )
    ).json()["tokens"]
    assert (await client.get(f"{API}/stores/me", headers=_bearer(new_owner))).json()["id"] == store[
        "id"
    ]

    # Reglas: con cuenta y rol de comerciante, y sin otra tienda.
    nobody = await client.patch(
        url, json={"owner_email": "nadie@correo.com"}, headers=_bearer(admin)
    )
    assert nobody.json()["code"] == "store_owner_not_registered"
    await _register(client, "cliente@correo.com")
    not_merchant = await client.patch(
        url, json={"owner_email": "cliente@correo.com"}, headers=_bearer(admin)
    )
    assert not_merchant.json()["code"] == "store_owner_not_merchant"
    other = await _create(client, admin, "otra@correo.com", "Otra tienda")
    taken = await client.patch(
        f"{URL}/{other['id']}", json={"owner_email": "nuevo@correo.com"}, headers=_bearer(admin)
    )
    assert taken.json()["code"] == "owner_already_has_store"
