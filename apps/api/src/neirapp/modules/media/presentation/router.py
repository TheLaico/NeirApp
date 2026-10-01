"""Subida y entrega de imágenes (fotos de tienda, de producto y del perfil de profesionales).

El navegador manda el archivo como cuerpo crudo con su `Content-Type`
(`fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })`). Se valida el
tamaño y los primeros bytes del archivo (no se confía en el `Content-Type`).

Toda imagen se reduce en el servidor (lado mayor de `MAX_SIDE` px) y se guarda como WebP: así una
foto de celular de varios MB ocupa unos pocos cientos de KB, y la base de fotos crece poco. Se
guarda con un nombre aleatorio: el nombre original del usuario nunca toca el disco.

Los archivos van a `settings.uploads_dir` (disco local). Para varios servidores conviene cambiar
`_save`/`_path` por un almacenamiento de objetos (S3, GCS…): el resto no cambia.
"""

import asyncio
import io
import re
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.shared.domain.errors import NotFoundError, ValidationError

# Lo que se acepta al subir (las fotos de celular pesan varios MB); lo guardado queda mucho menor.
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_SIDE = 1200
WEBP_QUALITY = 80
MAX_PIXELS = 50_000_000
_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|webp)$")

# Suben fotos quienes arman algo que ven los clientes: comerciantes, profesionales y el admin.
RequireUploader = Annotated[
    User, Depends(require_roles(Role.STORE_STAFF, Role.PROFESSIONAL, Role.ADMIN))
]

router = APIRouter(prefix="/uploads", tags=["media"])


class InvalidImage(ValidationError):
    code = "invalid_image"

    @classmethod
    def default_message(cls) -> str:
        return "El archivo no es una imagen válida. Usa una foto JPG, PNG o WebP."


class ImageTooLarge(ValidationError):
    code = "image_too_large"

    @classmethod
    def default_message(cls) -> str:
        return "La imagen pesa demasiado. El máximo es 10 MB."


class ImageNotFound(NotFoundError):
    code = "image_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Imagen no encontrada."


class UploadedImage(BaseModel):
    url: str


def _extension(data: bytes) -> str | None:
    """Tipo real del archivo según su firma; `None` si no es PNG, JPEG ni WebP."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _shrink(data: bytes) -> bytes:
    """Reduce la imagen (lado mayor `MAX_SIDE`), respeta la orientación de la cámara y la guarda
    como WebP. Lanza `InvalidImage` si el archivo está dañado o es sospechosamente enorme."""
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.width * source.height > MAX_PIXELS:
                raise InvalidImage()
            image = ImageOps.exif_transpose(source)
            image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            out = io.BytesIO()
            image.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage() from exc


def _directory(request: Request) -> Path:
    return Path(request.app.state.settings.uploads_dir)


@router.post("/images", response_model=UploadedImage, status_code=201)
async def upload_image(request: Request, _user: RequireUploader) -> UploadedImage:
    """Sube una imagen (cuerpo crudo, máx. 10 MB), la reduce y devuelve su URL."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise ImageTooLarge()
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_IMAGE_BYTES:
            raise ImageTooLarge()
    if _extension(bytes(data[:16])) is None:
        raise InvalidImage()
    shrunk = await asyncio.to_thread(_shrink, bytes(data))

    directory = _directory(request)
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{uuid4().hex}.webp"
    (directory / name).write_bytes(shrunk)
    return UploadedImage(url=f"/api/v1/uploads/images/{name}")


@router.get("/images/{name}")
async def get_image(name: str, request: Request) -> FileResponse:
    """Entrega una imagen subida. El nombre se valida por patrón: no se sale de la carpeta."""
    if not _NAME.match(name):
        raise ImageNotFound()
    path = _directory(request) / name
    if not path.is_file():
        raise ImageNotFound()
    # Los nombres son aleatorios e inmutables: se pueden cachear sin miedo.
    return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})
