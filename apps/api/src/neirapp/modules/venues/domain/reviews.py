from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from neirapp.modules.venues.domain.errors import InvalidReply, InvalidReview

MAX_COMMENT = 500
MAX_REPLY = 500


@dataclass
class Review:
    """La calificación de un huésped (1 a 5 estrellas) con su comentario, y la respuesta del lugar.
    Una por persona y lugar: si vuelve a calificar, se actualiza la suya."""

    id: UUID
    venue_id: UUID
    user_id: UUID
    author_name: str
    stars: int
    comment: str
    created_at: datetime
    updated_at: datetime
    reply: str = ""
    replied_at: datetime | None = None

    @classmethod
    def create(
        cls, venue_id: UUID, user_id: UUID, author: str, stars: int, comment: str, now: datetime
    ) -> "Review":
        review = cls(uuid4(), venue_id, user_id, author, 0, "", now, now)
        review.edit(stars, comment, now)
        return review

    def edit(self, stars: int, comment: str, now: datetime) -> None:
        comment = comment.strip()
        if not 1 <= stars <= 5 or len(comment) > MAX_COMMENT:
            raise InvalidReview()
        self.stars = stars
        self.comment = comment
        self.updated_at = now

    def answer(self, text: str, now: datetime) -> None:
        text = text.strip()
        if text and not 2 <= len(text) <= MAX_REPLY:
            raise InvalidReply()
        self.reply = text
        self.replied_at = now if text else None


@dataclass(frozen=True)
class Rating:
    average: float
    count: int

    @classmethod
    def of(cls, reviews: list[Review]) -> "Rating":
        if not reviews:
            return cls(0.0, 0)
        return cls(round(sum(r.stars for r in reviews) / len(reviews), 1), len(reviews))
