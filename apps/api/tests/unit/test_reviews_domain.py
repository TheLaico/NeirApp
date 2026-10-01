from datetime import UTC, datetime
from uuid import uuid4

import pytest

from neirapp.modules.reviews.domain.entities import Review, compute_rating_summary
from neirapp.modules.reviews.domain.errors import InvalidRating

NOW = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)


def _review(rating: int = 5) -> Review:
    return Review.create(
        store_order_id=uuid4(),
        order_id=uuid4(),
        store_id=uuid4(),
        customer_id=uuid4(),
        rating=rating,
        comment="Muy buena atención",
        now=NOW,
    )


class TestReviewCreate:
    @pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
    def test_rating_valido(self, rating: int) -> None:
        review = _review(rating)
        assert review.rating == rating

    @pytest.mark.parametrize("rating", [0, -1, 6, 10])
    def test_rating_invalido_falla(self, rating: int) -> None:
        with pytest.raises(InvalidRating):
            _review(rating)

    def test_comentario_se_recorta_y_limpia(self) -> None:
        review = Review.create(
            store_order_id=uuid4(),
            order_id=uuid4(),
            store_id=uuid4(),
            customer_id=uuid4(),
            rating=4,
            comment="   con espacios   ",
            now=NOW,
        )
        assert review.comment == "con espacios"

    def test_comentario_vacio_se_guarda_como_none(self) -> None:
        review = Review.create(
            store_order_id=uuid4(),
            order_id=uuid4(),
            store_id=uuid4(),
            customer_id=uuid4(),
            rating=4,
            comment="   ",
            now=NOW,
        )
        assert review.comment is None

    def test_sin_comentario(self) -> None:
        review = Review.create(
            store_order_id=uuid4(),
            order_id=uuid4(),
            store_id=uuid4(),
            customer_id=uuid4(),
            rating=3,
            comment=None,
            now=NOW,
        )
        assert review.comment is None


class TestComputeRatingSummary:
    def test_sin_reviews(self) -> None:
        summary = compute_rating_summary([])
        assert summary.average == 0.0
        assert summary.count == 0

    def test_promedio_redondeado_a_un_decimal(self) -> None:
        reviews = [_review(5), _review(4), _review(4)]
        summary = compute_rating_summary(reviews)
        assert summary.average == 4.3
        assert summary.count == 3
