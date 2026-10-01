import re
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.errors import InvalidGalleryImage, TextTooLong

MAX_IMAGES = 30
MAX_CAPTION = 140
# Solo fotos subidas a la app (POST /uploads/images): nombre aleatorio de 32 caracteres hex.
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")


def clean_caption(raw: str) -> str:
    caption = " ".join(raw.split())
    if len(caption) > MAX_CAPTION:
        raise TextTooLong()
    return caption


@dataclass
class GalleryImage:
    """Una foto del trabajo de un profesional, con un pie de foto opcional."""

    id: UUID
    user_id: UUID
    url: str
    caption: str
    position: int
    created_at: datetime

    @classmethod
    def create(
        cls, user_id: UUID, url: str, caption: str, position: int, now: datetime
    ) -> "GalleryImage":
        url = url.strip()
        if not _UPLOADED.match(url):
            raise InvalidGalleryImage()
        return cls(
            id=uuid4(),
            user_id=user_id,
            url=url,
            caption=clean_caption(caption),
            position=position,
            created_at=now,
        )
