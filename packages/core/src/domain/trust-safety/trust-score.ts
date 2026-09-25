import type { GuildLicense } from './guild-verification.js';
import type { CustomerReview } from './customer-review.js';

export interface TrustScoreBreakdown {
  readonly guildVerified: boolean;
  readonly hallmarkAuditCount: number;
  readonly verifiedReviewCount: number;
  readonly averageReviewRating: number;
  readonly trustScore: number; // 0 to 100
  readonly trustTier: 'UNVERIFIED' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

export class TrustScoreCalculator {
  /**
   * Computes an authoritative trust score strictly based on verifiable evidence.
   * - Guild verification: up to 40 points
   * - Verified hallmark audits: up to 20 points (5 points per audit, max 4)
   * - Verified customer reviews: up to 40 points (weighted by average rating and quantity)
   */
  public static calculate(params: {
    license?: GuildLicense | null | undefined;
    hallmarkAuditCount: number;
    reviews: CustomerReview[];
  }): TrustScoreBreakdown {
    let score = 0;

    // 1. Guild License Component (0 or 40)
    const isGuildVerified =
      params.license !== null &&
      params.license !== undefined &&
      params.license.status === 'VERIFIED';
    if (isGuildVerified) {
      score += 40;
    }

    // 2. Hallmark Audits Component (max 20 points)
    const auditCount = Math.max(0, params.hallmarkAuditCount);
    const hallmarkPoints = Math.min(20, auditCount * 5);
    score += hallmarkPoints;

    // 3. Customer Reviews Component (max 40 points)
    const approvedReviews = params.reviews.filter(
      (r) => r.moderationStatus === 'APPROVED' && r.isVerifiedPurchase
    );
    const verifiedReviewCount = approvedReviews.length;
    let averageRating = 0;

    if (verifiedReviewCount > 0) {
      const sumRatings = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
      averageRating = Math.round((sumRatings / verifiedReviewCount) * 10) / 10;

      // Base review score on rating: 5 stars = 30 pts, 4 stars = 24 pts, etc.
      const ratingFactor = (averageRating / 5) * 30;
      // Volume factor: up to 10 pts for having multiple verified reviews
      const volumeFactor = Math.min(10, verifiedReviewCount * 2);
      score += Math.round(ratingFactor + volumeFactor);
    }

    const finalScore = Math.min(100, Math.max(0, score));

    let tier: 'UNVERIFIED' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'UNVERIFIED';
    if (finalScore >= 85) {
      tier = 'PLATINUM';
    } else if (finalScore >= 70) {
      tier = 'GOLD';
    } else if (finalScore >= 40) {
      tier = 'SILVER';
    }

    return {
      guildVerified: isGuildVerified,
      hallmarkAuditCount: auditCount,
      verifiedReviewCount,
      averageReviewRating: averageRating,
      trustScore: finalScore,
      trustTier: tier,
    };
  }
}
