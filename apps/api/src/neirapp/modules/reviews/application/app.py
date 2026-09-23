from dataclasses import dataclass

from neirapp.modules.reviews.application.reviews import (
    CreateReview,
    GetStoreRatingSummary,
    ListStoreReviews,
)


@dataclass(frozen=True)
class ReviewsApp:
    create_review: CreateReview
    list_store_reviews: ListStoreReviews
    get_store_rating_summary: GetStoreRatingSummary
