"""Herramientas del vendedor: fotos, imagen de la tienda y respuesta a reseñas."""

import io
from typing import Any

import httpx
from fastapi import FastAPI
from PIL import Image

from tests.integration.test_reviews_api import (
    API,
    STORE_BODY,
    _admin_tokens,
    _bearer,
    _handed_over_store_order,
    _register,
)


def _image(fmt: str, size: tuple[int, int] = (8, 8)) -> bytes:
    """Una imagen real (el servidor la decodifica y la reduce, ya no basta con la firma)."""
    out = io.BytesIO()
    Image.new("RGB", size, (200, 120, 40)).save(out, format=fmt)
    return out.getvalue()


PNG = _image("PNG")
JPEG = _image("JPEG")
WEBP = _image("WEBP")
UPLOAD = f"{API}/uploads/images"


async def _upload(client: httpx.AsyncClient, tokens: dict[str, Any], body: bytes) -> Any:
    return await client.post(
        UPLOAD,
        content=body,
        headers={**_bearer(tokens), "Content-Type": "application/octet-stream"},
    )


class TestSubirImagenes:
    async def test_un_admin_sube_y_luego_descarga_la_imagen(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)

        for body in (PNG, JPEG, WEBP):
            response = await _upload(client, admin, body)
            assert response.status_code == 201, response.text
            url = response.json()["url"]
            # Todas se guardan como WebP, sin importar el formato con el que se subieron.
            assert url.startswith(f"{API}/uploads/images/") and url.endswith(".webp")
            served = await client.get(url)  # pública: las fotos las ven los clientes
            assert served.status_code == 200
            assert served.content[:4] == b"RIFF" and served.content[8:12] == b"WEBP"

    async def test_reduce_las_fotos_grandes(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin_tokens(client, app)
        big = _image("PNG", (3000, 2000))

        response = await _upload(client, admin, big)

        assert response.status_code == 201, response.text
        served = await client.get(response.json()["url"])
        saved = Image.open(io.BytesIO(served.content))
        assert saved.size == (1200, 800)  # lado mayor a 1200 px, conserva la proporción
        assert len(served.content) < len(big)

    async def test_una_firma_valida_con_contenido_roto_se_rechaza(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)

        response = await _upload(client, admin, b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)

        assert response.status_code == 422
        assert response.json()["code"] == "invalid_image"

    async def test_cualquier_cuenta_puede_subir_fotos_y_sin_sesion_no(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)
        customer = await _register(client, "cliente@correo.com")
        merchant = await _register(client, "comercio@correo.com")
        await client.post(
            f"{API}/identity/admin/role-grants",
            json={"email": "comercio@correo.com", "role": "store_staff"},
            headers=_bearer(admin),
        )
        merchant = (
            await client.post(
                f"{API}/identity/login",
                json={"email": "comercio@correo.com", "password": "clave-segura-123"},
            )
        ).json()["tokens"]

        assert (await _upload(client, merchant, PNG)).status_code == 201
        # Cualquiera publica inmuebles en MarquetNeira, así que también sube fotos.
        assert (await _upload(client, customer, PNG)).status_code == 201
        assert (await client.post(UPLOAD, content=PNG)).status_code == 401

    async def test_un_profesional_autorizado_puede_subir_su_foto(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)
        await _register(client, "profesional@correo.com")
        await client.post(
            f"{API}/identity/admin/role-grants",
            json={"email": "profesional@correo.com", "role": "professional"},
            headers=_bearer(admin),
        )
        professional = (
            await client.post(
                f"{API}/identity/login",
                json={"email": "profesional@correo.com", "password": "clave-segura-123"},
            )
        ).json()["tokens"]

        assert (await _upload(client, professional, JPEG)).status_code == 201

    async def test_rechaza_lo_que_no_es_una_imagen(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)

        for body in (b"esto es texto", b"<svg onload=alert(1)></svg>", b""):
            response = await _upload(client, admin, body)
            assert response.status_code == 422, body
            assert response.json()["code"] == "invalid_image"

    async def test_rechaza_imagenes_de_mas_de_10_mb(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin_tokens(client, app)

        response = await _upload(client, admin, PNG + b"\x00" * (10 * 1024 * 1024))

        assert response.status_code == 422
        assert response.json()["code"] == "image_too_large"

    async def test_no_se_puede_salir_de_la_carpeta_ni_pedir_archivos_ajenos(
        self, client: httpx.AsyncClient
    ) -> None:
        for name in ("../secreto.png", "..%2F..%2F.env", "a" * 32 + ".png", "x.exe"):
            assert (await client.get(f"{UPLOAD}/{name}")).status_code == 404, name


class TestImagenDeLaTienda:
    async def _seller_store(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        admin = await _admin_tokens(client, app)
        owner = await _register(client, "duena@correo.com")
        store = (await client.post(f"{API}/stores", json=STORE_BODY, headers=_bearer(owner))).json()
        await client.patch(
            f"{API}/stores/{store['id']}/approval",
            json={"is_approved": True},
            headers=_bearer(admin),
        )
        return admin, owner, store

    async def test_el_dueno_pone_cambia_y_quita_la_imagen_de_su_tienda(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store = await self._seller_store(client, app)
        url = (await _upload(client, admin, PNG)).json()["url"]
        endpoint = f"{API}/stores/{store['id']}"

        put = await client.patch(endpoint, json={"image_url": url}, headers=_bearer(owner))
        assert put.json()["image_url"] == url
        assert (await client.get(endpoint)).json()["image_url"] == url  # la ven los clientes

        # Editar otra cosa no borra la foto.
        other = await client.patch(endpoint, json={"description": "Nueva"}, headers=_bearer(owner))
        assert other.json()["image_url"] == url

        removed = await client.patch(endpoint, json={"image_url": ""}, headers=_bearer(owner))
        assert removed.json()["image_url"] is None

    async def test_el_dueno_pone_y_quita_el_logo_de_su_tienda(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store = await self._seller_store(client, app)
        url = (await _upload(client, admin, PNG)).json()["url"]
        endpoint = f"{API}/stores/{store['id']}"

        put = await client.patch(endpoint, json={"logo_url": url}, headers=_bearer(owner))
        assert put.json()["logo_url"] == url
        assert put.json()["image_url"] is None  # el logo no es la foto del local
        listed = (await client.get(f"{API}/stores")).json()
        assert next(s for s in listed if s["id"] == store["id"])["logo_url"] == url

        bad = await client.patch(endpoint, json={"logo_url": "ftp://x"}, headers=_bearer(owner))
        assert bad.json()["code"] == "invalid_image_url"

        removed = await client.patch(endpoint, json={"logo_url": ""}, headers=_bearer(owner))
        assert removed.json()["logo_url"] is None

    async def test_solo_acepta_fotos_de_la_app_o_enlaces_https(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        _admin, owner, store = await self._seller_store(client, app)
        endpoint = f"{API}/stores/{store['id']}"

        for bad in (
            "javascript:alert(1)",
            "http://sitio.com/a.png",
            "/etc/passwd",
            "data:image/png;base64,AA",
        ):
            response = await client.patch(endpoint, json={"image_url": bad}, headers=_bearer(owner))
            assert response.status_code == 422, bad
            assert response.json()["code"] == "invalid_image_url"

        ok = await client.patch(
            endpoint,
            json={"image_url": "https://cdn.ejemplo.com/local.jpg"},
            headers=_bearer(owner),
        )
        assert ok.status_code == 200

    async def test_la_imagen_de_un_producto_tambien_se_valida_y_se_puede_quitar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store = await self._seller_store(client, app)
        url = (await _upload(client, admin, JPEG)).json()["url"]
        products = f"{API}/stores/{store['id']}/products"

        bad = await client.post(
            products,
            json={"name": "Pan", "price_cop": 1000, "image_url": "ftp://x"},
            headers=_bearer(owner),
        )
        assert bad.status_code == 422

        created = (
            await client.post(
                products,
                json={"name": "Pan", "price_cop": 1000, "image_url": url},
                headers=_bearer(owner),
            )
        ).json()
        assert created["image_url"] == url
        cleared = await client.patch(
            f"{products}/{created['id']}", json={"image_url": ""}, headers=_bearer(owner)
        )
        assert cleared.json()["image_url"] is None

    async def test_una_tienda_no_pasa_de_20_fotos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store = await self._seller_store(client, app)
        url = (await _upload(client, admin, JPEG)).json()["url"]
        products = f"{API}/stores/{store['id']}/products"
        headers = _bearer(owner)

        # 1 foto de la tienda + 19 de productos = 20.
        assert (
            await client.patch(
                f"{API}/stores/{store['id']}", json={"image_url": url}, headers=headers
            )
        ).status_code == 200
        ids = []
        for i in range(19):
            response = await client.post(
                products,
                json={"name": f"P{i}", "price_cop": 1000, "image_url": url},
                headers=headers,
            )
            assert response.status_code == 201, response.text
            ids.append(response.json()["id"])

        # La foto 21 se rechaza con el mensaje de hablar con el desarrollador.
        extra = await client.post(
            products, json={"name": "P20", "price_cop": 1000, "image_url": url}, headers=headers
        )
        assert extra.status_code == 422
        assert extra.json()["code"] == "photo_limit_reached"
        assert "desarrollador" in extra.json()["detail"]

        # Sin foto sí se puede crear producto, y reemplazar una foto existente no cuenta como nueva.
        assert (
            await client.post(
                products, json={"name": "Sin foto", "price_cop": 1000}, headers=headers
            )
        ).status_code == 201
        assert (
            await client.patch(f"{products}/{ids[0]}", json={"image_url": url}, headers=headers)
        ).status_code == 200

        # Quitar una foto libera un cupo.
        await client.patch(f"{products}/{ids[1]}", json={"image_url": ""}, headers=headers)
        again = await client.post(
            products, json={"name": "P21", "price_cop": 1000, "image_url": url}, headers=headers
        )
        assert again.status_code == 201

    async def test_otro_usuario_no_puede_cambiar_la_imagen(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        _admin, _owner, store = await self._seller_store(client, app)
        intruder = await _register(client, "intruso@correo.com")

        response = await client.patch(
            f"{API}/stores/{store['id']}",
            json={"image_url": "https://cdn.ejemplo.com/x.jpg"},
            headers=_bearer(intruder),
        )

        assert response.status_code == 403


class TestResponderResenas:
    async def _reviewed(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """Devuelve (reseña, tokens del dueño, tokens del cliente)."""
        store_order_id, customer, store_id = await _handed_over_store_order(client, app)
        review = (
            await client.post(
                f"{API}/reviews",
                json={"store_order_id": store_order_id, "rating": 2, "comment": "Llegó frío"},
                headers=_bearer(customer),
            )
        ).json()
        owner = (
            await client.post(
                f"{API}/identity/login",
                json={"email": "duena@correo.com", "password": "clave-segura-123"},
            )
        ).json()["tokens"]
        assert store_id
        return review, owner, customer

    async def test_el_dueno_responde_y_la_respuesta_es_publica(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        review, owner, _customer = await self._reviewed(client, app)
        assert review["merchant_reply"] is None

        replied = await client.post(
            f"{API}/reviews/{review['id']}/reply",
            json={"text": "  Lo sentimos,   mejoraremos. "},
            headers=_bearer(owner),
        )

        assert replied.status_code == 200, replied.text
        assert replied.json()["merchant_reply"] == "Lo sentimos, mejoraremos."
        assert replied.json()["replied_at"] is not None
        store_id = (await client.get(f"{API}/stores", headers=_bearer(owner))).json()[0]["id"]
        public = await client.get(f"{API}/reviews/stores/{store_id}")  # sin sesión
        assert public.json()[0]["merchant_reply"] == "Lo sentimos, mejoraremos."

    async def test_responder_de_nuevo_reemplaza_la_respuesta(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        review, owner, _customer = await self._reviewed(client, app)
        url = f"{API}/reviews/{review['id']}/reply"
        await client.post(url, json={"text": "Primera"}, headers=_bearer(owner))

        second = await client.post(url, json={"text": "Segunda"}, headers=_bearer(owner))

        assert second.json()["merchant_reply"] == "Segunda"

    async def test_solo_el_dueno_de_esa_tienda_puede_responder(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        review, _owner, customer = await self._reviewed(client, app)
        other_store_owner = await _register(client, "otra@correo.com")
        url = f"{API}/reviews/{review['id']}/reply"

        by_customer = await client.post(url, json={"text": "Gracias"}, headers=_bearer(customer))
        by_other = await client.post(
            url, json={"text": "Gracias"}, headers=_bearer(other_store_owner)
        )

        assert by_customer.status_code == 403
        assert by_other.status_code == 403
        assert by_other.json()["code"] == "not_reviewed_store_owner"

    async def test_validaciones_de_la_respuesta(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        review, owner, _customer = await self._reviewed(client, app)
        url = f"{API}/reviews/{review['id']}/reply"

        assert (
            await client.post(url, json={"text": "a"}, headers=_bearer(owner))
        ).status_code == 422
        blank = await client.post(url, json={"text": "   ok"}, headers=_bearer(owner))
        assert blank.status_code == 200
        missing = await client.post(
            f"{API}/reviews/{'0' * 8}-0000-0000-0000-{'0' * 12}/reply",
            json={"text": "Hola"},
            headers=_bearer(owner),
        )
        assert missing.status_code == 404
        assert missing.json()["code"] == "review_not_found"
