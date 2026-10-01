from dataclasses import dataclass

from neirapp.modules.reviews.application.reviews import (
    CreateReview,
    GetStoreRatingSummary,
    ListRatingSummaries,
    ListStoreReviews,
    ReplyToReview,
)


@dataclass(frozen=True)
class ReviewsApp:
    create_review: CreateReview
    list_store_reviews: ListStoreReviews
    get_store_rating_summary: GetStoreRatingSummary
    list_rating_summaries: ListRatingSummaries
    reply_to_review: ReplyToReview
