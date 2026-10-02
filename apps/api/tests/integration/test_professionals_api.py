from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register

PROFILE = {
    "title": "Dra.",
    "full_name": "Laura Torres",
    "headline": "Pediatra con 8 años de experiencia",
    "category_id": "medicina",
    "subcategory_id": "pediatria",
    "experience_years": 8,
    "description": "Atiendo niños y adolescentes.",
    "phone": "310 123 4567",
    "whatsapp": "310 123 4567",
    "email": "laura@correo.com",
    "address": "Calle 10 # 8-25, Neira",
    "schedule": "Lunes a viernes de 8 a 5",
    "modalities": {"office": True, "home": True, "online": False},
    "is_available": True,
}


@pytest.fixture(autouse=True)
async def _categorias(app: FastAPI) -> None:
    """Las áreas que usan los perfiles de estas pruebas (en la app real las carga la migración)."""
    pro = app.state.professionals
    for label, icon, subs in [
        ("Medicina", "Stethoscope", ["Medicina general", "Pediatría"]),
        ("Derecho", "Scale", ["Derecho civil"]),
    ]:
        category = await pro.create_category(label, icon, "#b6533c")
        for sub in subs:
            await pro.add_subcategory(category.id, sub, "#b6533c")


async def _grant(client: httpx.AsyncClient, admin: dict[str, Any], email: str) -> None:
    response = await client.post(
        f"{API}/identity/admin/role-grants",
        json={"email": email, "role": "professional"},
        headers=_bearer(admin),
    )
    assert response.status_code in (200, 201), response.text


async def _professional(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str
) -> dict[str, Any]:
    await _grant(client, admin, email)
    tokens = await _register(client, email)  # el rol llega al registrarse con el correo autorizado
    return tokens


class TestMiPerfil:
    async def test_crea_consulta_y_actualiza_su_perfil(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        missing = await client.get(f"{API}/professionals/me", headers=_bearer(pro))
        assert missing.status_code == 404
        assert missing.json()["code"] == "professional_profile_not_found"

        created = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        assert created.status_code == 200, created.text
        body = created.json()
        assert body["display_name"] == "Dra. Laura Torres"
        assert body["phone"] == "3101234567"
        assert body["modalities"] == {"office": True, "home": True, "online": False}

        updated = await client.put(
            f"{API}/professionals/me",
            json={**PROFILE, "is_available": False},
            headers=_bearer(pro),
        )
        assert updated.json()["is_available"] is False
        mine = await client.get(f"{API}/professionals/me", headers=_bearer(pro))
        assert mine.json()["is_available"] is False

    async def test_valida_los_datos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        response = await client.put(
            f"{API}/professionals/me", json={**PROFILE, "phone": "123"}, headers=_bearer(pro)
        )

        assert response.status_code == 422
        assert response.json()["code"] == "invalid_phone"

    async def test_solo_profesionales_autorizados(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        customer = await _register(client, "cliente@correo.com")

        response = await client.put(
            f"{API}/professionals/me", json=PROFILE, headers=_bearer(customer)
        )

        assert response.status_code == 403
        assert (await client.put(f"{API}/professionals/me", json=PROFILE)).status_code == 401


class TestDirectorio:
    async def test_lista_y_filtra_por_especialidad(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        laura = await _professional(client, admin, "laura@correo.com")
        carlos = await _professional(client, admin, "carlos@correo.com")
        await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(laura))
        await client.put(
            f"{API}/professionals/me",
            json={
                **PROFILE,
                "title": "Abg.",
                "full_name": "Carlos Gómez",
                "category_id": "derecho",
                "subcategory_id": "derecho-civil",
            },
            headers=_bearer(carlos),
        )

        everyone = (await client.get(f"{API}/professionals")).json()
        pediatras = (
            await client.get(f"{API}/professionals", params={"subcategory_id": "pediatria"})
        ).json()
        derecho = (
            await client.get(f"{API}/professionals", params={"category_id": "derecho"})
        ).json()

        assert {p["full_name"] for p in everyone} == {"Laura Torres", "Carlos Gómez"}
        assert [p["full_name"] for p in pediatras] == ["Laura Torres"]
        assert [p["full_name"] for p in derecho] == ["Carlos Gómez"]

    async def test_destacados_primero_y_luego_los_disponibles(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        names = ["Ana Ramírez", "Beto Ruiz", "Ceci Mora"]
        ids = []
        for i, name in enumerate(names):
            tokens = await _professional(client, admin, f"pro{i}@correo.com")
            saved = await client.put(
                f"{API}/professionals/me",
                json={**PROFILE, "full_name": name, "is_available": name != "Beto Ruiz"},
                headers=_bearer(tokens),
            )
            ids.append(saved.json()["user_id"])

        featured = await client.put(
            f"{API}/professionals/{ids[1]}/featured",
            json={"is_featured": True},
            headers=_bearer(admin),
        )
        assert featured.status_code == 200, featured.text

        order = [p["full_name"] for p in (await client.get(f"{API}/professionals")).json()]
        assert order[0] == "Beto Ruiz"  # destacado, aunque no esté disponible
        assert set(order[1:]) == {"Ana Ramírez", "Ceci Mora"}

    async def test_solo_el_admin_destaca(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]

        response = await client.put(
            f"{API}/professionals/{user_id}/featured",
            json={"is_featured": True},
            headers=_bearer(pro),
        )

        assert response.status_code == 403

    async def test_si_le_quitan_el_acceso_desaparece_del_directorio(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]
        assert (await client.get(f"{API}/professionals/{user_id}")).status_code == 200

        revoked = await client.delete(
            f"{API}/identity/admin/role-grants",
            params={"email": "laura@correo.com", "role": "professional"},
            headers=_bearer(admin),
        )
        assert revoked.status_code == 204, revoked.text

        assert (await client.get(f"{API}/professionals")).json() == []
        assert (await client.get(f"{API}/professionals/{user_id}")).status_code == 404


class TestCategorias:
    async def test_cualquiera_ve_las_categorias_con_sus_especialidades(
        self, client: httpx.AsyncClient
    ) -> None:
        response = await client.get(f"{API}/professionals/categories")

        assert response.status_code == 200
        medicina = response.json()[0]
        assert medicina["id"] == "medicina"
        assert [s["id"] for s in medicina["subcategories"]] == ["medicina-general", "pediatria"]

    async def test_el_admin_crea_y_borra_categorias_y_especialidades(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)

        created = await client.post(
            f"{API}/professionals/categories",
            json={"label": "  Enfermería ", "icon": "Stethoscope", "color": "#1D8A9C"},
            headers=_bearer(admin),
        )
        assert created.status_code == 201, created.text
        assert created.json() == {
            "id": "enfermeria",
            "label": "Enfermería",
            "icon": "Stethoscope",
            "color": "#1d8a9c",
            "subcategories": [],
        }
        sub = await client.post(
            f"{API}/professionals/categories/enfermeria/subcategories",
            json={"label": "Cuidado en casa", "color": "#1d8a9c"},
            headers=_bearer(admin),
        )
        assert sub.json()["id"] == "cuidado-en-casa"
        recolored = await client.put(
            f"{API}/professionals/categories/enfermeria/subcategories/cuidado-en-casa/color",
            json={"color": "#e8a92c"},
            headers=_bearer(admin),
        )
        assert recolored.json()["color"] == "#e8a92c"

        # Un nombre repetido recibe otro id en vez de pisar el existente.
        again = await client.post(
            f"{API}/professionals/categories",
            json={"label": "Enfermería", "icon": "Cog", "color": "#000000"},
            headers=_bearer(admin),
        )
        assert again.json()["id"] == "enfermeria-2"

        deleted = await client.delete(
            f"{API}/professionals/categories/enfermeria", headers=_bearer(admin)
        )
        assert deleted.status_code == 204
        ids = [c["id"] for c in (await client.get(f"{API}/professionals/categories")).json()]
        assert ids == ["medicina", "derecho", "enfermeria-2"]

    async def test_valida_nombre_icono_y_color(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        for body, code in [
            ({"label": "x", "icon": "Cog", "color": "#000000"}, "invalid_category_label"),
            ({"label": "Arte", "icon": "Rocket", "color": "#000000"}, "invalid_icon"),
            ({"label": "Arte", "icon": "Cog", "color": "rojo"}, "invalid_color"),
        ]:
            response = await client.post(
                f"{API}/professionals/categories", json=body, headers=_bearer(admin)
            )
            assert response.status_code == 422
            assert response.json()["code"] == code

    async def test_solo_el_admin_las_gestiona(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client, "cliente@correo.com")
        body = {"label": "Arte", "icon": "Cog", "color": "#000000"}

        response = await client.post(
            f"{API}/professionals/categories", json=body, headers=_bearer(customer)
        )

        assert response.status_code == 403

    async def test_no_se_borra_una_categoria_que_usan_perfiles(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))

        for path in ("medicina", "medicina/subcategories/pediatria"):
            response = await client.delete(
                f"{API}/professionals/categories/{path}", headers=_bearer(admin)
            )
            assert response.status_code == 409
            assert response.json()["code"] == "category_in_use"

    async def test_el_perfil_solo_acepta_categorias_que_existen(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        for change in ({"category_id": "astrologia"}, {"subcategory_id": "derecho-civil"}):
            response = await client.put(
                f"{API}/professionals/me", json={**PROFILE, **change}, headers=_bearer(pro)
            )
            assert response.status_code == 422
            assert response.json()["code"] == "invalid_category"


SERVICE = {
    "name": "Consulta pediátrica",
    "description": "Control de crecimiento y desarrollo.",
    "price_kind": "fixed",
    "price_cop": 80000,
    "duration_minutes": 30,
}


class TestServicios:
    async def test_el_profesional_gestiona_sus_servicios(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        url = f"{API}/professionals/me/services"

        first = await client.post(url, json=SERVICE, headers=_bearer(pro))
        assert first.status_code == 201, first.text
        second = await client.post(
            url,
            json={"name": "Visita a domicilio", "price_kind": "quote", "price_cop": 1},
            headers=_bearer(pro),
        )
        assert second.json()["price_cop"] is None

        service_id = first.json()["id"]
        edited = await client.put(
            f"{url}/{service_id}",
            json={**SERVICE, "price_kind": "from", "price_cop": 70000, "is_active": False},
            headers=_bearer(pro),
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["price_kind"] == "from" and edited.json()["is_active"] is False

        mine = (await client.get(url, headers=_bearer(pro))).json()
        assert [s["name"] for s in mine] == ["Consulta pediátrica", "Visita a domicilio"]

        deleted = await client.delete(f"{url}/{service_id}", headers=_bearer(pro))
        assert deleted.status_code == 204
        assert len((await client.get(url, headers=_bearer(pro))).json()) == 1

    async def test_valida_el_precio(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        response = await client.post(
            f"{API}/professionals/me/services",
            json={**SERVICE, "price_cop": None},
            headers=_bearer(pro),
        )

        assert response.status_code == 422
        assert response.json()["code"] == "invalid_service_price"

    async def test_no_toca_servicios_de_otro_profesional(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        laura = await _professional(client, admin, "laura@correo.com")
        carlos = await _professional(client, admin, "carlos@correo.com")
        service_id = (
            await client.post(
                f"{API}/professionals/me/services", json=SERVICE, headers=_bearer(laura)
            )
        ).json()["id"]

        for method in ("PUT", "DELETE"):
            response = await client.request(
                method,
                f"{API}/professionals/me/services/{service_id}",
                json=SERVICE if method == "PUT" else None,
                headers=_bearer(carlos),
            )
            assert response.status_code == 404

    async def test_los_clientes_ven_solo_los_visibles(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]
        url = f"{API}/professionals/me/services"
        await client.post(url, json=SERVICE, headers=_bearer(pro))
        await client.post(
            url,
            json={**SERVICE, "name": "Servicio oculto", "is_active": False},
            headers=_bearer(pro),
        )

        public = await client.get(f"{API}/professionals/{user_id}/services")

        assert public.status_code == 200
        assert [s["name"] for s in public.json()] == ["Consulta pediátrica"]

    async def test_solo_profesionales(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client, "cliente@correo.com")
        response = await client.post(
            f"{API}/professionals/me/services", json=SERVICE, headers=_bearer(customer)
        )
        assert response.status_code == 403


def _photo(n: int) -> str:
    return f"/api/v1/uploads/images/{n:032x}.webp"


class TestGaleria:
    async def test_el_profesional_arma_su_galeria(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        url = f"{API}/professionals/me/gallery"

        ids = []
        for n in range(3):
            added = await client.post(
                url, json={"url": _photo(n), "caption": f"Foto {n}"}, headers=_bearer(pro)
            )
            assert added.status_code == 201, added.text
            ids.append(added.json()["id"])

        captioned = await client.patch(
            f"{url}/{ids[1]}", json={"caption": "  Consultorio   nuevo "}, headers=_bearer(pro)
        )
        assert captioned.json()["caption"] == "Consultorio nuevo"

        reordered = await client.put(
            f"{url}/order", json={"ids": [ids[2], ids[0], ids[1]]}, headers=_bearer(pro)
        )
        assert reordered.status_code == 200, reordered.text
        assert [i["id"] for i in reordered.json()] == [ids[2], ids[0], ids[1]]

        assert (await client.delete(f"{url}/{ids[0]}", headers=_bearer(pro))).status_code == 204
        mine = (await client.get(url, headers=_bearer(pro))).json()
        assert [i["id"] for i in mine] == [ids[2], ids[1]]

    async def test_solo_fotos_subidas_a_la_app(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        for bad in ("https://otro-sitio.com/foto.jpg", "/api/v1/uploads/images/../../etc.png"):
            response = await client.post(
                f"{API}/professionals/me/gallery", json={"url": bad}, headers=_bearer(pro)
            )
            assert response.status_code == 422
            assert response.json()["code"] == "invalid_gallery_image"

    async def test_el_orden_debe_incluir_todas_las_fotos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        url = f"{API}/professionals/me/gallery"
        a = (await client.post(url, json={"url": _photo(1)}, headers=_bearer(pro))).json()["id"]
        await client.post(url, json={"url": _photo(2)}, headers=_bearer(pro))

        for ids in ([a], [a, a]):
            response = await client.put(f"{url}/order", json={"ids": ids}, headers=_bearer(pro))
            assert response.status_code == 422
            assert response.json()["code"] == "invalid_gallery_order"

    async def test_no_toca_fotos_de_otro_profesional(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        laura = await _professional(client, admin, "laura@correo.com")
        carlos = await _professional(client, admin, "carlos@correo.com")
        url = f"{API}/professionals/me/gallery"
        image_id = (await client.post(url, json={"url": _photo(1)}, headers=_bearer(laura))).json()[
            "id"
        ]

        edit = await client.patch(
            f"{url}/{image_id}", json={"caption": "mía"}, headers=_bearer(carlos)
        )
        remove = await client.delete(f"{url}/{image_id}", headers=_bearer(carlos))

        assert edit.status_code == 404 and remove.status_code == 404

    async def test_los_clientes_ven_la_galeria(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]
        await client.post(
            f"{API}/professionals/me/gallery",
            json={"url": _photo(1), "caption": "Mi consultorio"},
            headers=_bearer(pro),
        )

        public = await client.get(f"{API}/professionals/{user_id}/gallery")

        assert public.status_code == 200
        assert [i["caption"] for i in public.json()] == ["Mi consultorio"]


PDF_BYTES = b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n"


async def _upload_pdf(client: httpx.AsyncClient, tokens: dict[str, Any]) -> str:
    response = await client.post(
        f"{API}/uploads/documents",
        content=PDF_BYTES,
        headers={**_bearer(tokens), "Content-Type": "application/pdf"},
    )
    assert response.status_code == 201, response.text
    return response.json()["url"]  # type: ignore[no-any-return]


class TestDocumentos:
    async def test_sube_y_entrega_un_pdf(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        url = await _upload_pdf(client, pro)

        served = await client.get(url)
        assert served.status_code == 200
        assert served.headers["content-type"] == "application/pdf"
        assert served.headers["x-content-type-options"] == "nosniff"
        assert served.content == PDF_BYTES

    async def test_rechaza_lo_que_no_es_pdf(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        for body in (b"<html><script>alert(1)</script></html>", b"%PDF-1.4 sin cierre"):
            response = await client.post(
                f"{API}/uploads/documents", content=body, headers=_bearer(pro)
            )
            assert response.status_code == 422
            assert response.json()["code"] == "invalid_document"

    async def test_solo_profesionales_suben_documentos(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client, "cliente@correo.com")
        response = await client.post(
            f"{API}/uploads/documents", content=PDF_BYTES, headers=_bearer(customer)
        )
        assert response.status_code == 403

    async def test_no_entrega_rutas_inventadas(self, client: httpx.AsyncClient) -> None:
        for name in ("../../etc/passwd", "a" * 32 + ".exe", "noexiste" * 4 + ".pdf"):
            response = await client.get(f"{API}/uploads/documents/{name}")
            assert response.status_code == 404


class TestCertificados:
    async def test_flujo_de_revision(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]
        body = {
            "kind": "license",
            "title": "Tarjeta profesional",
            "issuer": "Ministerio de Salud",
            "year": 2016,
            "file_url": await _upload_pdf(client, pro),
        }

        created = await client.post(
            f"{API}/professionals/me/certificates", json=body, headers=_bearer(pro)
        )
        assert created.status_code == 201, created.text
        assert created.json()["status"] == "pending"
        certificate_id = created.json()["id"]
        public = f"{API}/professionals/{user_id}/certificates"
        assert (await client.get(public)).json() == []  # en revisión: no se ve

        pending = (
            await client.get(f"{API}/professionals/certificates/pending", headers=_bearer(admin))
        ).json()
        assert [(p["title"], p["professional_name"]) for p in pending] == [
            ("Tarjeta profesional", "Dra. Laura Torres")
        ]

        rejected = await client.put(
            f"{API}/professionals/certificates/{certificate_id}/review",
            json={"approve": False, "note": "El documento se ve borroso"},
            headers=_bearer(admin),
        )
        assert rejected.json()["status"] == "rejected"
        mine = (
            await client.get(f"{API}/professionals/me/certificates", headers=_bearer(pro))
        ).json()
        assert mine[0]["review_note"] == "El documento se ve borroso"

        # Lo corrige con otro archivo: vuelve a revisión y el admin lo aprueba.
        fixed = await client.put(
            f"{API}/professionals/me/certificates/{certificate_id}",
            json={**body, "file_url": await _upload_pdf(client, pro)},
            headers=_bearer(pro),
        )
        assert fixed.json()["status"] == "pending"
        await client.put(
            f"{API}/professionals/certificates/{certificate_id}/review",
            json={"approve": True},
            headers=_bearer(admin),
        )

        shown = (await client.get(public)).json()
        assert [c["title"] for c in shown] == ["Tarjeta profesional"]
        assert "review_note" not in shown[0] and "status" not in shown[0]

    async def test_solo_el_admin_revisa(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com")

        assert (
            await client.get(f"{API}/professionals/certificates/pending", headers=_bearer(pro))
        ).status_code == 403

    async def test_no_toca_certificados_de_otro(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        laura = await _professional(client, admin, "laura@correo.com")
        carlos = await _professional(client, admin, "carlos@correo.com")
        body = {"kind": "degree", "title": "Pediatra", "file_url": await _upload_pdf(client, laura)}
        certificate_id = (
            await client.post(
                f"{API}/professionals/me/certificates", json=body, headers=_bearer(laura)
            )
        ).json()["id"]

        response = await client.delete(
            f"{API}/professionals/me/certificates/{certificate_id}", headers=_bearer(carlos)
        )

        assert response.status_code == 404


REQUEST = {
    "modality": "home",
    "message": "Necesito una visita para mi hijo con fiebre desde ayer.",
    "phone": "315 765 4321",
    "preferred_time": "morning",
    "address": "Carrera 9 # 10-30, Neira",
}


async def _published(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str
) -> tuple[dict[str, Any], str]:
    """Un profesional con perfil publicado (atiende en consultorio y a domicilio)."""
    tokens = await _professional(client, admin, email)
    saved = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(tokens))
    return tokens, saved.json()["user_id"]


class TestSolicitudes:
    async def test_flujo_completo(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        service_id = (
            await client.post(
                f"{API}/professionals/me/services", json=SERVICE, headers=_bearer(pro)
            )
        ).json()["id"]
        customer = await _register(client, "cliente@correo.com")

        sent = await client.post(
            f"{API}/professionals/{pro_id}/requests",
            json={**REQUEST, "service_id": service_id},
            headers=_bearer(customer),
        )
        assert sent.status_code == 201, sent.text
        assert sent.json()["status"] == "pending"
        assert sent.json()["service_name"] == "Consulta pediátrica"
        assert sent.json()["customer_phone"] == "3157654321"
        request_id = sent.json()["id"]

        received = (
            await client.get(f"{API}/professionals/me/requests", headers=_bearer(pro))
        ).json()
        assert [r["customer_name"] for r in received] == ["Ana Gómez"]

        scheduled = await client.put(
            f"{API}/professionals/me/requests/{request_id}/schedule",
            json={"scheduled_at": "2030-01-10T15:00:00-05:00", "note": "Llevar el carné"},
            headers=_bearer(pro),
        )
        assert scheduled.status_code == 200, scheduled.text
        assert scheduled.json()["status"] == "scheduled"

        mine = (
            await client.get(f"{API}/professionals/requests/mine", headers=_bearer(customer))
        ).json()
        assert mine[0]["professional_name"] == "Dra. Laura Torres"
        assert mine[0]["status"] == "scheduled" and mine[0]["note"] == "Llevar el carné"

        done = await client.put(
            f"{API}/professionals/me/requests/{request_id}/complete", headers=_bearer(pro)
        )
        assert done.json()["status"] == "completed"
        # Ya hecha: no se puede cancelar.
        late = await client.put(
            f"{API}/professionals/requests/{request_id}/cancel", json={}, headers=_bearer(customer)
        )
        assert late.status_code == 409

    async def test_el_cliente_cancela_y_el_profesional_rechaza(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        url = f"{API}/professionals/{pro_id}/requests"
        first = (await client.post(url, json=REQUEST, headers=_bearer(customer))).json()["id"]
        second = (await client.post(url, json=REQUEST, headers=_bearer(customer))).json()["id"]

        cancelled = await client.put(
            f"{API}/professionals/requests/{first}/cancel",
            json={"note": "Ya me atendieron"},
            headers=_bearer(customer),
        )
        assert cancelled.json()["status"] == "cancelled"
        assert cancelled.json()["cancelled_by_customer"] is True

        rejected = await client.put(
            f"{API}/professionals/me/requests/{second}/reject",
            json={"note": "Esa semana estoy fuera de Neira"},
            headers=_bearer(pro),
        )
        assert rejected.json()["status"] == "rejected"

    async def test_valida_la_solicitud(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        url = f"{API}/professionals/{pro_id}/requests"

        for change in (
            {"modality": "online"},  # no atiende virtual
            {"address": ""},  # a domicilio sin dirección
            {"message": "hola"},
            {"preferred_date": "2000-01-01"},
        ):
            response = await client.post(url, json={**REQUEST, **change}, headers=_bearer(customer))
            assert response.status_code == 422, change
            assert response.json()["code"] == "invalid_appointment_request"

        self_request = await client.post(url, json=REQUEST, headers=_bearer(pro))
        assert self_request.json()["code"] == "cannot_request_yourself"

    async def test_maximo_tres_pendientes_por_profesional(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        _, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        url = f"{API}/professionals/{pro_id}/requests"

        for _ in range(3):
            assert (
                await client.post(url, json=REQUEST, headers=_bearer(customer))
            ).status_code == 201
        fourth = await client.post(url, json=REQUEST, headers=_bearer(customer))

        assert fourth.json()["code"] == "too_many_pending_requests"

    async def test_nadie_mas_toca_la_solicitud(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        _, pro_id = await _published(client, admin, "laura@correo.com")
        other_pro, _ = await _published(client, admin, "carlos@correo.com")
        customer = await _register(client, "cliente@correo.com")
        stranger = await _register(client, "otro@correo.com")
        request_id = (
            await client.post(
                f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
            )
        ).json()["id"]

        by_other_pro = await client.put(
            f"{API}/professionals/me/requests/{request_id}/reject",
            json={},
            headers=_bearer(other_pro),
        )
        by_stranger = await client.put(
            f"{API}/professionals/requests/{request_id}/cancel", json={}, headers=_bearer(stranger)
        )

        assert by_other_pro.status_code == 404 and by_stranger.status_code == 404

    async def test_no_se_programa_en_el_pasado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        request_id = (
            await client.post(
                f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
            )
        ).json()["id"]

        response = await client.put(
            f"{API}/professionals/me/requests/{request_id}/schedule",
            json={"scheduled_at": "2001-01-10T15:00:00-05:00"},
            headers=_bearer(pro),
        )

        assert response.status_code == 422


async def _inbox(client: httpx.AsyncClient, tokens: dict[str, Any]) -> dict[str, Any]:
    response = await client.get(f"{API}/notifications", headers=_bearer(tokens))
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]


class TestNotificaciones:
    async def test_avisos_de_una_cita_a_cada_lado(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        request_id = (
            await client.post(
                f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
            )
        ).json()["id"]

        pro_inbox = await _inbox(client, pro)
        assert pro_inbox["unread"] == 1
        assert pro_inbox["items"][0]["kind"] == "request_new"
        assert pro_inbox["items"][0]["link"] == "/profesional?seccion=requests"

        await client.put(
            f"{API}/professionals/me/requests/{request_id}/schedule",
            json={"scheduled_at": "2030-01-10T15:00:00Z", "note": "Traer el carné"},
            headers=_bearer(pro),
        )
        clock.advance(minutes=5)
        await client.put(
            f"{API}/professionals/me/requests/{request_id}/schedule",
            json={"scheduled_at": "2030-01-11T15:00:00Z"},
            headers=_bearer(pro),
        )
        customer_inbox = await _inbox(client, customer)
        kinds = [n["kind"] for n in customer_inbox["items"]]
        assert kinds == ["request_rescheduled", "request_scheduled"]
        scheduled = customer_inbox["items"][1]
        assert (
            "Dra. Laura Torres te espera el jueves 10 de enero a las 10:00 a. m."
            in scheduled["body"]
        )
        assert "Traer el carné" in scheduled["body"]

        await client.put(
            f"{API}/professionals/requests/{request_id}/cancel",
            json={"note": "Ya me siento mejor"},
            headers=_bearer(customer),
        )
        pro_inbox = await _inbox(client, pro)
        assert pro_inbox["items"][0]["kind"] == "request_cancelled"
        assert "Ya me siento mejor" in pro_inbox["items"][0]["body"]

    async def test_aviso_de_certificado_revisado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, _ = await _published(client, admin, "laura@correo.com")
        body = {"kind": "degree", "title": "Pediatra", "file_url": await _upload_pdf(client, pro)}
        certificate_id = (
            await client.post(
                f"{API}/professionals/me/certificates", json=body, headers=_bearer(pro)
            )
        ).json()["id"]

        await client.put(
            f"{API}/professionals/certificates/{certificate_id}/review",
            json={"approve": False, "note": "La foto está borrosa"},
            headers=_bearer(admin),
        )

        latest = (await _inbox(client, pro))["items"][0]
        assert latest["kind"] == "certificate_rejected"
        assert "La foto está borrosa" in latest["body"]

    async def test_leer_y_borrar(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        for _ in range(2):
            await client.post(
                f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
            )
        first, second = (await _inbox(client, pro))["items"]

        await client.put(f"{API}/notifications/{first['id']}/read", headers=_bearer(pro))
        assert (await _inbox(client, pro))["unread"] == 1
        await client.put(f"{API}/notifications/read", headers=_bearer(pro))
        assert (await _inbox(client, pro))["unread"] == 0

        await client.delete(f"{API}/notifications/{first['id']}", headers=_bearer(pro))
        assert [n["id"] for n in (await _inbox(client, pro))["items"]] == [second["id"]]
        await client.delete(f"{API}/notifications", headers=_bearer(pro))
        assert (await _inbox(client, pro))["items"] == []

    async def test_cada_quien_solo_toca_las_suyas(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        await client.post(
            f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
        )
        notification_id = (await _inbox(client, pro))["items"][0]["id"]

        read = await client.put(
            f"{API}/notifications/{notification_id}/read", headers=_bearer(customer)
        )
        remove = await client.delete(
            f"{API}/notifications/{notification_id}", headers=_bearer(customer)
        )

        assert read.status_code == 404 and remove.status_code == 404
        assert (await _inbox(client, pro))["unread"] == 1
        assert (await client.get(f"{API}/notifications")).status_code == 401


class TestConfiguracion:
    async def test_ocultar_el_perfil_lo_saca_del_directorio(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")

        saved = await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": False, "accepts_requests": True},
            headers=_bearer(pro),
        )
        assert saved.status_code == 200
        assert saved.json()["is_listed"] is False

        directory = await client.get(f"{API}/professionals")
        assert pro_id not in [p["user_id"] for p in directory.json()]
        assert (await client.get(f"{API}/professionals/{pro_id}")).status_code == 404
        sent = await client.post(
            f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
        )
        assert sent.status_code == 404

        # Su perfil sigue intacto y lo puede volver a mostrar.
        mine = await client.get(f"{API}/professionals/me", headers=_bearer(pro))
        assert mine.json()["headline"] == PROFILE["headline"]
        await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": True, "accepts_requests": True},
            headers=_bearer(pro),
        )
        assert (await client.get(f"{API}/professionals/{pro_id}")).status_code == 200

    async def test_pausar_solicitudes(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro, pro_id = await _published(client, admin, "laura@correo.com")
        customer = await _register(client, "cliente@correo.com")
        await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": True, "accepts_requests": False},
            headers=_bearer(pro),
        )

        public = await client.get(f"{API}/professionals/{pro_id}")
        assert public.json()["accepts_requests"] is False
        sent = await client.post(
            f"{API}/professionals/{pro_id}/requests", json=REQUEST, headers=_bearer(customer)
        )
        assert sent.status_code == 422
        assert sent.json()["code"] == "requests_paused"

    async def test_guardar_el_perfil_no_cambia_los_ajustes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, _ = await _published(client, admin, "laura@correo.com")
        await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": False, "accepts_requests": False},
            headers=_bearer(pro),
        )
        saved = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        assert saved.json()["is_listed"] is False
        assert saved.json()["accepts_requests"] is False

    async def test_requiere_perfil_y_rol(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "nuevo@correo.com")
        body = {"is_listed": False, "accepts_requests": True}
        no_profile = await client.put(
            f"{API}/professionals/me/settings", json=body, headers=_bearer(pro)
        )
        assert no_profile.status_code == 404
        customer = await _register(client, "cliente@correo.com")
        forbidden = await client.put(
            f"{API}/professionals/me/settings", json=body, headers=_bearer(customer)
        )
        assert forbidden.status_code == 403
