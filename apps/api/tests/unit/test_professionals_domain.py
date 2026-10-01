from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from neirapp.modules.professionals.domain.entities import (
    Modalities,
    ProfessionalProfile,
    ProfileData,
    normalize_mobile,
)
from neirapp.modules.professionals.domain.errors import (
    InvalidCategory,
    InvalidContactEmail,
    InvalidExperience,
    InvalidFullName,
    InvalidPhone,
    InvalidPhotoUrl,
    InvalidTitle,
    NoModality,
    TextTooLong,
)

NOW = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
DATA = ProfileData(
    title="Dr.",
    full_name="  Andrés   Patiño ",
    category_id="medicina",
    subcategory_id="medicina-general",
    phone="+57 310 123 4567",
    experience_years=8,
    description="Consulta general.\nNiños y adultos.",
    email="Andres@Correo.com ",
)


class TestCrearPerfil:
    def test_limpia_y_normaliza_los_datos(self) -> None:
        profile = ProfessionalProfile.create(uuid4(), DATA, NOW)

        assert profile.full_name == "Andrés Patiño"
        assert profile.display_name == "Dr. Andrés Patiño"
        assert profile.phone == "3101234567"
        assert profile.whatsapp == ""
        assert profile.email == "andres@correo.com"
        assert profile.description == "Consulta general.\nNiños y adultos."
        assert profile.is_featured is False
        assert profile.created_at == profile.updated_at == NOW

    @pytest.mark.parametrize(
        ("change", "error"),
        [
            ({"full_name": "Al"}, InvalidFullName),
            ({"title": "Sr."}, InvalidTitle),
            ({"category_id": ""}, InvalidCategory),
            ({"category_id": "Medicina General"}, InvalidCategory),
            ({"subcategory_id": "<script>"}, InvalidCategory),
            ({"experience_years": 71}, InvalidExperience),
            ({"experience_years": -1}, InvalidExperience),
            ({"phone": "6068881234"}, InvalidPhone),
            ({"phone": "310 123"}, InvalidPhone),
            ({"whatsapp": "123"}, InvalidPhone),
            ({"email": "no-es-correo"}, InvalidContactEmail),
            ({"headline": "x" * 91}, TextTooLong),
            ({"description": "x" * 601}, TextTooLong),
            ({"modalities": Modalities(office=False)}, NoModality),
            ({"photo_url": "https://otro-sitio.com/foto.jpg"}, InvalidPhotoUrl),
        ],
    )
    def test_rechaza_datos_invalidos(self, change: dict[str, object], error: type) -> None:
        with pytest.raises(error):
            ProfessionalProfile.create(uuid4(), replace(DATA, **change), NOW)  # type: ignore[arg-type]

    def test_acepta_fotos_subidas_a_la_app(self) -> None:
        url = "/api/v1/uploads/images/" + "a" * 32 + ".webp"
        profile = ProfessionalProfile.create(uuid4(), replace(DATA, photo_url=url), NOW)
        assert profile.photo_url == url


class TestActualizarPerfil:
    def test_reemplaza_los_datos_y_conserva_el_destacado(self) -> None:
        profile = ProfessionalProfile.create(uuid4(), DATA, NOW)
        profile.is_featured = True
        later = NOW + timedelta(days=1)

        profile.update(replace(DATA, headline="Medicina familiar", is_available=False), later)

        assert profile.headline == "Medicina familiar"
        assert profile.is_available is False
        assert profile.is_featured is True
        assert profile.created_at == NOW and profile.updated_at == later


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("3101234567", "3101234567"), ("310-123-4567", "3101234567"), ("+573101234567", "3101234567")],
)
def test_normaliza_celulares(raw: str, expected: str) -> None:
    assert normalize_mobile(raw) == expected
