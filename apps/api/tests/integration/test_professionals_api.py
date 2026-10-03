from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from neirapp.modules.professionals.domain import plans as plans_domain
from tests.conftest import FakeClock
from tests.integration.test_leads_api import API, _admin, _bearer, _register


@pytest.fixture(autouse=True)
def _todos_los_planes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Por ahora solo se ofrece el plan único, pero la lógica de Básico, Profesional y Premium se
    conserva para el futuro: estas pruebas la siguen cubriendo con todos los planes habilitados."""
    monkeypatch.setattr(plans_domain, "AVAILABLE_PLANS", frozenset(plans_domain.PlanId))


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
    client: httpx.AsyncClient, admin: dict[str, Any], email: str, plan: str | None = "pro"
) -> dict[str, Any]:
    """Profesional autorizado; por defecto con el plan Profesional (sin plan no se publica)."""
    await _grant(client, admin, email)
    tokens = await _register(client, email)  # el rol llega al registrarse con el correo autorizado
    if plan:
        await _set_plan(client, admin, tokens, plan)
    return tokens


async def _user_id(client: httpx.AsyncClient, tokens: dict[str, Any]) -> str:
    me = await client.get(f"{API}/identity/me", headers=_bearer(tokens))
    return me.json()["id"]  # type: ignore[no-any-return]


async def _set_plan(
    client: httpx.AsyncClient, admin: dict[str, Any], tokens: dict[str, Any], plan: str
) -> None:
    user_id = await _user_id(client, tokens)
    response = await client.put(
        f"{API}/professionals/{user_id}/plan", json={"plan": plan}, headers=_bearer(admin)
    )
    assert response.status_code == 200, response.text
    # Activar el plan le deja un aviso; se borra para que las pruebas de avisos partan de cero.
    await client.delete(f"{API}/notifications", headers=_bearer(tokens))


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


async def _published(
    client: httpx.AsyncClient, admin: dict[str, Any], email: str
) -> tuple[dict[str, Any], str]:
    """Un profesional con perfil publicado (atiende en consultorio y a domicilio)."""
    tokens = await _professional(client, admin, email)
    saved = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(tokens))
    return tokens, saved.json()["user_id"]


async def _inbox(client: httpx.AsyncClient, tokens: dict[str, Any]) -> dict[str, Any]:
    response = await client.get(f"{API}/notifications", headers=_bearer(tokens))
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]


async def _grant_month(client: httpx.AsyncClient, admin: dict[str, Any], pro_id: str) -> None:
    """El administrador le activa un mes de plan: le deja un aviso (que aquí sí se conserva)."""
    response = await client.put(
        f"{API}/professionals/{pro_id}/plan", json={"plan": "unico"}, headers=_bearer(admin)
    )
    assert response.status_code == 200, response.text


class TestNotificaciones:
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
        for _ in range(2):
            await _grant_month(client, admin, pro_id)
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
        await _grant_month(client, admin, pro_id)
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

        saved = await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": False},
            headers=_bearer(pro),
        )
        assert saved.status_code == 200
        assert saved.json()["is_listed"] is False

        directory = await client.get(f"{API}/professionals")
        assert pro_id not in [p["user_id"] for p in directory.json()]
        assert (await client.get(f"{API}/professionals/{pro_id}")).status_code == 404
        # Su perfil sigue intacto y lo puede volver a mostrar.
        mine = await client.get(f"{API}/professionals/me", headers=_bearer(pro))
        assert mine.json()["headline"] == PROFILE["headline"]
        await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": True},
            headers=_bearer(pro),
        )
        assert (await client.get(f"{API}/professionals/{pro_id}")).status_code == 200

    async def test_guardar_el_perfil_no_cambia_los_ajustes(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro, _ = await _published(client, admin, "laura@correo.com")
        await client.put(
            f"{API}/professionals/me/settings",
            json={"is_listed": False},
            headers=_bearer(pro),
        )
        saved = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        assert saved.json()["is_listed"] is False

    async def test_requiere_perfil_y_rol(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "nuevo@correo.com")
        body = {"is_listed": False}
        no_profile = await client.put(
            f"{API}/professionals/me/settings", json=body, headers=_bearer(pro)
        )
        assert no_profile.status_code == 404
        customer = await _register(client, "cliente@correo.com")
        forbidden = await client.put(
            f"{API}/professionals/me/settings", json=body, headers=_bearer(customer)
        )
        assert forbidden.status_code == 403


async def _plan(client: httpx.AsyncClient, tokens: dict[str, Any]) -> dict[str, Any]:
    response = await client.get(f"{API}/professionals/me/plan", headers=_bearer(tokens))
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]


async def _ask_plan(
    client: httpx.AsyncClient, tokens: dict[str, Any], plan: str, reference: str = "Nequi M12345"
) -> httpx.Response:
    return await client.post(
        f"{API}/professionals/me/plan/requests",
        json={"plan": plan, "payment_reference": reference},
        headers=_bearer(tokens),
    )


class TestPlanes:
    async def test_sin_plan_el_perfil_no_se_publica(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        saved = await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        user_id = saved.json()["user_id"]

        assert saved.json()["plan"] is None
        assert (await client.get(f"{API}/professionals")).json() == []
        assert (await client.get(f"{API}/professionals/{user_id}")).status_code == 404
        status = await _plan(client, pro)
        assert status["current"] is None
        assert status["max_images"] == 3

    async def test_pide_un_plan_y_el_admin_confirma_el_pago(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]

        asked = await _ask_plan(client, pro, "premium")
        assert asked.status_code == 201, asked.text
        pending = asked.json()["pending"]
        assert (pending["plan"], pending["status"], pending["price_cop"]) == (
            "premium",
            "pending",
            59900,
        )
        assert (await _ask_plan(client, pro, "pro")).json()["code"] == "plan_request_pending"

        overview = (
            await client.get(f"{API}/professionals/admin/plans", headers=_bearer(admin))
        ).json()
        assert overview[0]["display_name"] == "Dra. Laura Torres"
        assert overview[0]["status"]["pending"]["payment_reference"] == "Nequi M12345"

        approved = await client.put(
            f"{API}/professionals/plans/requests/{pending['id']}/approve", headers=_bearer(admin)
        )
        assert approved.status_code == 200, approved.text
        status = await _plan(client, pro)
        assert status["pending"] is None
        assert status["current"]["plan"] == "premium"
        assert status["current"]["expires_at"].startswith("2026-10-21")  # 30 días
        assert status["max_images"] == 100

        public = (await client.get(f"{API}/professionals/{user_id}")).json()
        assert public["plan"] == "premium"
        assert public["is_featured"] is True  # Premium aparece primero
        inbox = (await client.get(f"{API}/notifications", headers=_bearer(pro))).json()
        assert inbox["items"][0]["kind"] == "plan_activated"
        assert "21 de octubre" in inbox["items"][0]["body"]

    async def test_el_admin_ve_la_solicitud_aunque_no_haya_armado_su_perfil(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        assert (await _ask_plan(client, pro, "pro")).status_code == 201

        rows = (await client.get(f"{API}/professionals/admin/plans", headers=_bearer(admin))).json()
        assert len(rows) == 1
        row = rows[0]
        assert (row["display_name"], row["email"], row["has_profile"]) == (
            "Ana Gómez",
            "laura@correo.com",
            False,
        )
        assert row["phone"] == "3001234567"
        assert row["status"]["pending"]["plan"] == "pro"

    async def test_el_admin_rechaza_el_pago_con_un_motivo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        pending = (await _ask_plan(client, pro, "pro")).json()["pending"]
        url = f"{API}/professionals/plans/requests/{pending['id']}/reject"

        no_note = await client.put(url, json={"note": " "}, headers=_bearer(admin))
        assert no_note.status_code == 422
        rejected = await client.put(
            url, json={"note": "No encontramos el pago"}, headers=_bearer(admin)
        )
        assert rejected.json()["status"] == "rejected"

        status = await _plan(client, pro)
        assert status["current"] is None and status["pending"] is None
        assert status["last_rejected"]["note"] == "No encontramos el pago"
        # Ya revisada: no se puede aprobar después.
        again = await client.put(
            f"{API}/professionals/plans/requests/{pending['id']}/approve", headers=_bearer(admin)
        )
        assert again.status_code == 409
        # Puede volver a pedirlo; el rechazo anterior deja de mostrarse.
        assert (await _ask_plan(client, pro, "pro")).json()["last_rejected"] is None

    async def test_cancela_su_solicitud_pero_no_la_de_otro(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        other = await _professional(client, admin, "carlos@correo.com", plan=None)
        pending = (await _ask_plan(client, pro, "basic")).json()["pending"]
        url = f"{API}/professionals/me/plan/requests/{pending['id']}/cancel"

        assert (await client.put(url, headers=_bearer(other))).status_code == 404
        cancelled = await client.put(url, headers=_bearer(pro))
        assert cancelled.json()["pending"] is None

    async def test_renovar_suma_otro_mes_y_cambiar_de_plan_empieza_ya(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan="basic")

        await _set_plan(client, admin, pro, "basic")  # renovación del mismo plan
        status = await _plan(client, pro)
        assert status["current"]["plan"] == "basic"
        assert [s["starts_at"][:10] for s in status["upcoming"]] == ["2026-10-21"]

        await _set_plan(client, admin, pro, "pro")  # mejora: empieza hoy y cierra lo anterior
        status = await _plan(client, pro)
        assert status["current"]["plan"] == "pro"
        assert status["upcoming"] == []

    async def test_vence_a_los_30_dias_o_cuando_el_admin_lo_quita(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        admin = await _admin(client, app)
        _, laura_id = await _published(client, admin, "laura@correo.com")
        _, carlos_id = await _published(client, admin, "carlos@correo.com")

        removed = await client.delete(
            f"{API}/professionals/{carlos_id}/plan", headers=_bearer(admin)
        )
        assert removed.json()["current"] is None
        names = [p["user_id"] for p in (await client.get(f"{API}/professionals")).json()]
        assert names == [laura_id]

        clock.advance(days=31)
        assert (await client.get(f"{API}/professionals")).json() == []

    async def test_el_plan_basico_tiene_limites(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan="basic")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]

        for n in range(3):
            added = await client.post(
                f"{API}/professionals/me/gallery",
                json={"url": _photo(n), "caption": ""},
                headers=_bearer(pro),
            )
            assert added.status_code == 201
        fourth = await client.post(
            f"{API}/professionals/me/gallery",
            json={"url": _photo(9), "caption": ""},
            headers=_bearer(pro),
        )
        assert fourth.json()["code"] == "too_many_images"

        # Con el plan Profesional ya puede subir más fotos.
        await _set_plan(client, admin, pro, "pro")
        fourth = await client.post(
            f"{API}/professionals/me/gallery",
            json={"url": _photo(9), "caption": ""},
            headers=_bearer(pro),
        )
        assert fourth.status_code == 201

        # Si vuelve al Básico, el perfil muestra solo las primeras 3 (las demás siguen guardadas).
        await _set_plan(client, admin, pro, "basic")
        public = (await client.get(f"{API}/professionals/{user_id}/gallery")).json()
        assert len(public) == 3
        mine = (await client.get(f"{API}/professionals/me/gallery", headers=_bearer(pro))).json()
        assert len(mine) == 4

    async def test_el_basico_no_muestra_certificados(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan="basic")
        user_id = await _user_id(client, pro)
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
        await client.put(
            f"{API}/professionals/certificates/{created.json()['id']}/review",
            json={"approve": True, "note": ""},
            headers=_bearer(admin),
        )
        public = f"{API}/professionals/{user_id}/certificates"
        assert (await client.get(public)).json() == []
        await _set_plan(client, admin, pro, "pro")
        assert len((await client.get(public)).json()) == 1

    async def test_permisos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        customer = await _register(client, "cliente@correo.com")
        pending = (await _ask_plan(client, pro, "pro")).json()["pending"]
        user_id = await _user_id(client, pro)

        assert (await _ask_plan(client, customer, "pro")).status_code == 403
        for method, url, body in (
            ("PUT", f"/professionals/plans/requests/{pending['id']}/approve", None),
            ("PUT", f"/professionals/{user_id}/plan", {"plan": "premium"}),
            ("GET", "/professionals/admin/plans", None),
        ):
            response = await client.request(method, f"{API}{url}", json=body, headers=_bearer(pro))
            assert response.status_code == 403, url


@pytest.fixture
def _solo_plan_unico(monkeypatch: pytest.MonkeyPatch) -> None:
    """Lo que se ofrece hoy: solo el plan único (deshace `_todos_los_planes` en estas pruebas)."""
    monkeypatch.setattr(plans_domain, "AVAILABLE_PLANS", frozenset({plans_domain.PlanId.UNICO}))


@pytest.mark.usefixtures("_solo_plan_unico")
class TestPlanUnico:
    """Por ahora solo se ofrece un plan: $ 15.000 con todo incluido y 5 fotos."""

    async def test_solo_se_puede_pedir_el_plan_unico(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)

        for old in ("basic", "pro", "premium"):
            response = await _ask_plan(client, pro, old)
            assert response.status_code == 422, old
            assert response.json()["code"] == "plan_not_available"

        asked = (await _ask_plan(client, pro, "unico")).json()["pending"]
        assert (asked["plan"], asked["plan_name"], asked["price_cop"]) == (
            "unico",
            "Profesional NeirAPP",
            15000,
        )

    async def test_incluye_todo_con_5_fotos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan="unico")
        user_id = (
            await client.put(f"{API}/professionals/me", json=PROFILE, headers=_bearer(pro))
        ).json()["user_id"]

        status = await _plan(client, pro)
        assert status["current"]["plan"] == "unico"
        assert status["max_images"] == 5
        assert status["shows_certificates"] is True
        public = (await client.get(f"{API}/professionals/{user_id}")).json()
        assert public["is_featured"] is True  # destacado, como el Premium

    async def test_el_admin_tampoco_activa_los_planes_viejos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        pro = await _professional(client, admin, "laura@correo.com", plan=None)
        me = (await client.get(f"{API}/identity/me", headers=_bearer(pro))).json()
        response = await client.put(
            f"{API}/professionals/{me['id']}/plan", json={"plan": "premium"}, headers=_bearer(admin)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "plan_not_available"
