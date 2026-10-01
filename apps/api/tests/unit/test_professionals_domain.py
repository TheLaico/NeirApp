from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from neirapp.modules.professionals.domain.certificates import (
    Certificate,
    CertificateData,
    CertificateKind,
    CertificateStatus,
)
from neirapp.modules.professionals.domain.entities import (
    Modalities,
    ProfessionalProfile,
    ProfileData,
    normalize_mobile,
)
from neirapp.modules.professionals.domain.errors import (
    InvalidCategory,
    InvalidCertificateFile,
    InvalidCertificateTitle,
    InvalidCertificateYear,
    InvalidContactEmail,
    InvalidExperience,
    InvalidFullName,
    InvalidPhone,
    InvalidPhotoUrl,
    InvalidServiceDuration,
    InvalidServiceName,
    InvalidServicePrice,
    InvalidTitle,
    MissingReviewNote,
    NoModality,
    TextTooLong,
)
from neirapp.modules.professionals.domain.notifications import when_label
from neirapp.modules.professionals.domain.services import (
    PriceKind,
    ProfessionalService,
    ServiceData,
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


class TestServicios:
    def _create(self, **change: object) -> ProfessionalService:
        data = replace(
            ServiceData(name="Consulta general", price_kind=PriceKind.FIXED, price_cop=80_000),
            **change,  # type: ignore[arg-type]
        )
        return ProfessionalService.create(uuid4(), data, 0, NOW)

    def test_crea_un_servicio_con_precio(self) -> None:
        service = self._create(name="  Consulta   general ", duration_minutes=30)
        assert service.name == "Consulta general"
        assert service.price_cop == 80_000
        assert service.duration_minutes == 30

    def test_a_convenir_no_guarda_precio(self) -> None:
        service = self._create(price_kind=PriceKind.QUOTE, price_cop=50_000)
        assert service.price_cop is None

    @pytest.mark.parametrize(
        ("change", "error"),
        [
            ({"name": "ab"}, InvalidServiceName),
            ({"price_cop": None}, InvalidServicePrice),
            ({"price_cop": 500}, InvalidServicePrice),
            ({"price_kind": PriceKind.FROM, "price_cop": 60_000_000}, InvalidServicePrice),
            ({"duration_minutes": 2}, InvalidServiceDuration),
            ({"duration_minutes": 13 * 60}, InvalidServiceDuration),
            ({"description": "x" * 301}, TextTooLong),
        ],
    )
    def test_rechaza_datos_invalidos(self, change: dict[str, object], error: type) -> None:
        with pytest.raises(error):
            self._create(**change)


PDF = "/api/v1/uploads/documents/" + "a" * 32 + ".pdf"


class TestCertificados:
    def _create(self, **change: object) -> Certificate:
        data = replace(
            CertificateData(kind=CertificateKind.DEGREE, title="Médico cirujano", file_url=PDF),
            **change,  # type: ignore[arg-type]
        )
        return Certificate.create(uuid4(), data, NOW)

    def test_arranca_en_revision_y_no_es_publico(self) -> None:
        certificate = self._create(issuer="  Universidad   de Caldas ", year=2015)
        assert certificate.issuer == "Universidad de Caldas"
        assert certificate.status is CertificateStatus.PENDING
        assert certificate.is_public is False

    @pytest.mark.parametrize(
        ("change", "error"),
        [
            ({"title": "ab"}, InvalidCertificateTitle),
            ({"year": 1900}, InvalidCertificateYear),
            ({"year": 2030}, InvalidCertificateYear),
            ({"file_url": "https://otro-sitio.com/titulo.pdf"}, InvalidCertificateFile),
            ({"file_url": "/api/v1/uploads/documents/../secreto.pdf"}, InvalidCertificateFile),
        ],
    )
    def test_rechaza_datos_invalidos(self, change: dict[str, object], error: type) -> None:
        with pytest.raises(error):
            self._create(**change)

    def test_aprobado_y_visible_es_publico(self) -> None:
        certificate = self._create()
        certificate.review(approve=True, note="", now=NOW)
        assert certificate.is_public is True

    def test_rechazar_exige_motivo(self) -> None:
        certificate = self._create()
        with pytest.raises(MissingReviewNote):
            certificate.review(approve=False, note="no", now=NOW)
        certificate.review(approve=False, note="El documento está borroso", now=NOW)
        assert certificate.status is CertificateStatus.REJECTED

    def test_editar_lo_revisado_vuelve_a_revision(self) -> None:
        certificate = self._create()
        certificate.review(approve=True, note="", now=NOW)

        certificate.update(
            CertificateData(
                kind=CertificateKind.DEGREE,
                title="Médico cirujano",
                file_url=PDF,
                show_on_profile=False,
            ),
            NOW,
        )
        assert certificate.status is CertificateStatus.VERIFIED  # solo cambió la visibilidad

        certificate.update(
            CertificateData(kind=CertificateKind.DEGREE, title="Médica cirujana", file_url=PDF),
            NOW,
        )
        assert certificate.status is CertificateStatus.PENDING


def test_fecha_de_la_cita_en_hora_de_colombia() -> None:
    # 15:30 UTC son las 10:30 a. m. en Colombia (UTC-5).
    moment = datetime(2026, 10, 2, 15, 30, tzinfo=UTC)
    assert when_label(moment) == "viernes 2 de octubre a las 10:30 a. m."
    assert when_label(datetime(2026, 10, 2, 23, 5, tzinfo=UTC)).endswith("a las 6:05 p. m.")
