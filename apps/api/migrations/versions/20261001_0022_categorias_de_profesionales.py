"""categorías y especialidades del directorio de profesionales (antes vivían en el navegador del
admin). Se cargan las mismas 10 áreas que traía el frontend.

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-01 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (id, nombre, ícono, color, [(id, nombre, color)])
DEFAULT_CATEGORIES = [
    (
        "ingenierias",
        "Ingenierías",
        "Cog",
        "#e8a92c",
        [
            ("ing-civil", "Ingeniería Civil", "#e8a92c"),
            ("ing-sistemas", "Ingeniería de Sistemas", "#e8a92c"),
            ("ing-industrial", "Ingeniería Industrial", "#e8a92c"),
            ("ing-ambiental", "Ingeniería Ambiental", "#e8a92c"),
        ],
    ),
    (
        "medicina",
        "Medicina",
        "Stethoscope",
        "#b6533c",
        [
            ("medicina-general", "Medicina general", "#b6533c"),
            ("pediatria", "Pediatría", "#b6533c"),
            ("odontologia", "Odontología", "#b6533c"),
            ("fisioterapia", "Fisioterapia", "#b6533c"),
        ],
    ),
    (
        "derecho",
        "Derecho",
        "Scale",
        "#2c5f8a",
        [
            ("derecho-civil", "Derecho civil", "#2c5f8a"),
            ("derecho-penal", "Derecho penal", "#2c5f8a"),
            ("derecho-laboral", "Derecho laboral", "#2c5f8a"),
        ],
    ),
    (
        "educacion",
        "Educación",
        "GraduationCap",
        "#d97706",
        [
            ("docencia", "Docencia", "#d97706"),
            ("tutorias", "Tutorías", "#d97706"),
            ("educacion-especial", "Educación especial", "#d97706"),
        ],
    ),
    (
        "contabilidad",
        "Contabilidad",
        "Calculator",
        "#1d8a9c",
        [
            ("contador-publico", "Contador público", "#1d8a9c"),
            ("auditoria", "Auditoría", "#1d8a9c"),
            ("asesoria-tributaria", "Asesoría tributaria", "#1d8a9c"),
        ],
    ),
    (
        "psicologia",
        "Psicología",
        "Brain",
        "#c0587a",
        [
            ("psicologia-clinica", "Psicología clínica", "#c0587a"),
            ("psicologia-infantil", "Psicología infantil", "#c0587a"),
            ("terapia-pareja", "Terapia de pareja", "#c0587a"),
        ],
    ),
    (
        "arquitectura",
        "Arquitectura",
        "Ruler",
        "#6a4c93",
        [
            ("arquitectura-residencial", "Arquitectura residencial", "#6a4c93"),
            ("diseno-interiores", "Diseño de interiores", "#6a4c93"),
            ("urbanismo", "Urbanismo", "#6a4c93"),
        ],
    ),
    (
        "tecnologia",
        "Tecnología",
        "Laptop",
        "#3b6e8f",
        [
            ("desarrollo-software", "Desarrollo de software", "#3b6e8f"),
            ("soporte-tecnico", "Soporte técnico", "#3b6e8f"),
            ("diseno-grafico", "Diseño gráfico", "#3b6e8f"),
        ],
    ),
    (
        "veterinaria",
        "Veterinaria",
        "PawPrint",
        "#2d7a3d",
        [
            ("veterinaria-general", "Veterinaria general", "#2d7a3d"),
            ("peluqueria-canina", "Peluquería canina", "#2d7a3d"),
            ("cirugia-veterinaria", "Cirugía veterinaria", "#2d7a3d"),
        ],
    ),
    ("otros", "Otros", "Ellipsis", "#6b7a70", []),
]


def upgrade() -> None:
    categories = op.create_table(
        "professionals_category",
        sa.Column("id", sa.String(60), primary_key=True),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("icon", sa.String(30), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    subcategories = op.create_table(
        "professionals_subcategory",
        sa.Column(
            "category_id",
            sa.String(60),
            sa.ForeignKey("professionals_category.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.String(60), primary_key=True),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    op.bulk_insert(
        categories,
        [
            {"id": cid, "label": label, "icon": icon, "color": color, "position": i}
            for i, (cid, label, icon, color, _) in enumerate(DEFAULT_CATEGORIES)
        ],
    )
    op.bulk_insert(
        subcategories,
        [
            {"category_id": cid, "id": sid, "label": label, "color": color, "position": j}
            for cid, _, _, _, subs in DEFAULT_CATEGORIES
            for j, (sid, label, color) in enumerate(subs)
        ],
    )


def downgrade() -> None:
    op.drop_table("professionals_subcategory")
    op.drop_table("professionals_category")
