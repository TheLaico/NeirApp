"""Subida y entrega de imágenes (fotos de tienda, de producto y de profesionales) y de
documentos PDF (certificados de profesionales).

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
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.shared.domain.errors import NotFoundError, ValidationError

# Lo que se acepta al subir (las fotos de celular pesan varios MB); lo guardado queda mucho menor.
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_SIDE = 1200
WEBP_QUALITY = 80
MAX_PIXELS = 50_000_000
_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|webp)$")
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
_DOCUMENT_NAME = re.compile(r"^[0-9a-f]{32}\.pdf$")

# Fotos: cualquier persona con cuenta, porque en MarquetNeira cualquiera publica sus muebles
# (antes solo comerciantes, profesionales y el admin). Se reducen y se guardan con nombre aleatorio.
RequireUploader = CurrentUser

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


class InvalidDocument(ValidationError):
    code = "invalid_document"

    @classmethod
    def default_message(cls) -> str:
        return "El archivo no es un PDF válido."


class DocumentTooLarge(ValidationError):
    code = "document_too_large"

    @classmethod
    def default_message(cls) -> str:
        return "El documento pesa demasiado. El máximo es 10 MB."


class DocumentNotFound(NotFoundError):
    code = "document_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Documento no encontrado."


# Solo los profesionales suben documentos (sus certificados); el admin, para pruebas y soporte.
RequireDocumentUploader = Annotated[User, Depends(require_roles(Role.PROFESSIONAL, Role.ADMIN))]


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


async def _read_body(request: Request, limit: int, too_large: type[ValidationError]) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise too_large()
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > limit:
            raise too_large()
    return bytes(data)


@router.post("/documents", response_model=UploadedImage, status_code=201)
async def upload_document(request: Request, _user: RequireDocumentUploader) -> UploadedImage:
    """Sube un PDF (cuerpo crudo, máx. 10 MB) y devuelve su URL. Se valida la firma y el cierre del
    archivo, no el `Content-Type`; se guarda con un nombre aleatorio."""
    data = await _read_body(request, MAX_DOCUMENT_BYTES, DocumentTooLarge)
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
        raise InvalidDocument()
    directory = _directory(request) / "documents"
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{uuid4().hex}.pdf"
    await asyncio.to_thread((directory / name).write_bytes, data)
    return UploadedImage(url=f"/api/v1/uploads/documents/{name}")


@router.get("/documents/{name}")
async def get_document(name: str, request: Request) -> FileResponse:
    """Entrega un PDF subido, para verlo en el navegador. El nombre se valida por patrón."""
    if not _DOCUMENT_NAME.match(name):
        raise DocumentNotFound()
    path = _directory(request) / "documents" / name
    if not path.is_file():
        raise DocumentNotFound()
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="certificado.pdf"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )
