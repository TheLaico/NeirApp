from typing import Any

import httpx
import pytest
from fastapi import FastAPI

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
