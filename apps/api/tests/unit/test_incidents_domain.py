from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from neirapp.modules.incidents.domain.entities import (
    Incident,
    IncidentCategory,
    IncidentStatus,
    ReporterRole,
)
from neirapp.modules.incidents.domain.errors import EmptyDescription, IncidentAlreadyResolved

NOW = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)
LATER = NOW + timedelta(minutes=10)


def _incident(role: ReporterRole = ReporterRole.CUSTOMER) -> Incident:
    return Incident.report(
        order_id=uuid4(),
        reporter_user_id=uuid4(),
        reporter_role=role,
        category=IncidentCategory.WRONG_ITEM,
        description="Me llegó una pizza equivocada",
        now=NOW,
    )


class TestReport:
    def test_reporte_valido(self) -> None:
        incident = _incident()
        assert incident.status == IncidentStatus.OPEN
        assert incident.resolved_at is None
        assert incident.reporter_role == ReporterRole.CUSTOMER

    def test_descripcion_se_recorta(self) -> None:
        incident = Incident.report(
            order_id=uuid4(),
            reporter_user_id=uuid4(),
            reporter_role=ReporterRole.COURIER,
            category=IncidentCategory.LATE_DELIVERY,
            description="   se demoró mucho   ",
            now=NOW,
        )
        assert incident.description == "se demoró mucho"

    @pytest.mark.parametrize("description", ["", "   "])
    def test_descripcion_vacia_falla(self, description: str) -> None:
        with pytest.raises(EmptyDescription):
            Incident.report(
                order_id=uuid4(),
                reporter_user_id=uuid4(),
                reporter_role=ReporterRole.CUSTOMER,
                category=IncidentCategory.OTHER,
                description=description,
                now=NOW,
            )


class TestResolve:
    def test_resolver_un_reporte_abierto(self) -> None:
        incident = _incident()
        incident.resolve(status=IncidentStatus.RESOLVED, resolution_note="Reembolsado", now=LATER)
        assert incident.status == IncidentStatus.RESOLVED
        assert incident.resolution_note == "Reembolsado"
        assert incident.resolved_at == LATER

    def test_descartar_un_reporte_abierto(self) -> None:
        incident = _incident()
        incident.resolve(status=IncidentStatus.DISMISSED, resolution_note=None, now=LATER)
        assert incident.status == IncidentStatus.DISMISSED
        assert incident.resolution_note is None

    def test_no_se_puede_resolver_dos_veces(self) -> None:
        incident = _incident()
        incident.resolve(status=IncidentStatus.RESOLVED, resolution_note=None, now=LATER)
        with pytest.raises(IncidentAlreadyResolved):
            incident.resolve(status=IncidentStatus.DISMISSED, resolution_note=None, now=LATER)

    def test_is_reported_by(self) -> None:
        incident = _incident()
        assert incident.is_reported_by(incident.reporter_user_id)
        assert not incident.is_reported_by(uuid4())
