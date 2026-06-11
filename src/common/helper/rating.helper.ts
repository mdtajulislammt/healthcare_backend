/**
 * Calculate average rating and review count from a list of reviews.
 * Only considers reviews with a valid rating.
 */
export function calculateRating(reviews: { rating?: number | null }[]): {
  avg_rating: number | null;
  review_count: number;
} {
  const validReviews = reviews.filter((r) => r.rating != null);
  const review_count = validReviews.length;

  if (review_count === 0) {
    return { avg_rating: null, review_count: 0 };
  }

  const avg_rating = Number(
    (
      validReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / review_count
    ).toFixed(1),
  );

  return { avg_rating, review_count };
}
