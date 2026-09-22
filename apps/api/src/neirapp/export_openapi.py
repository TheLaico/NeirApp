"""Exporta el esquema OpenAPI a un archivo. Alimenta la generación del cliente TypeScript.

Uso: python -m neirapp.export_openapi ../../packages/api-client/openapi.json
"""

import json
import sys
from pathlib import Path

from neirapp.bootstrap.app import create_app
from neirapp.bootstrap.settings import Settings


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    app = create_app(Settings(environment="test"))
    target.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"OpenAPI escrito en {target}")


if __name__ == "__main__":
    main()
