from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.reviews.application.app import ReviewsApp


def get_reviews(request: Request) -> ReviewsApp:
    reviews: ReviewsApp = request.app.state.reviews
    return reviews


ReviewsDep = Annotated[ReviewsApp, Depends(get_reviews)]
