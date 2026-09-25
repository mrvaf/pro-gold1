import { describe, it, expect } from 'vitest';
import {
  GuildLicense,
  HallmarkAuditRecord,
  CustomerReview,
  TrustScoreCalculator,
  InvalidGuildLicenseError,
  InvalidHallmarkAuditError,
  InvalidReviewModerationError,
} from '@v-gold/core';

describe('Stage 20 — Trust, Safety & Verification Domain Logic', () => {
  it('validates guild license creation and prevents expired verification', () => {
    const issuance = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const futureExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000);

    const license = GuildLicense.create({
      id: 'lic_1',
      tenantId: 'tenant_t1' as any,
      sellerProfileId: 'seller_1',
      guildRegistrationNumber: 'TEH-GOLD-998822',
      guildName: 'Tehran Gold and Jewelry Guild Union',
      issuanceDate: issuance,
      expiryDate: futureExpiry,
    });

    expect(license.status).toBe('PENDING');
    license.verify();
    expect(license.status).toBe('VERIFIED');
    expect(license.verifiedAt).toBeDefined();

    // Expired license cannot be verified
    const expiredLicense = GuildLicense.create({
      id: 'lic_2',
      tenantId: 'tenant_t1' as any,
      sellerProfileId: 'seller_2',
      guildRegistrationNumber: 'TEH-GOLD-112233',
      guildName: 'Tehran Guild',
      issuanceDate: new Date('2020-01-01'),
      expiryDate: new Date('2021-01-01'),
    });
    expect(() => expiredLicense.verify()).toThrow(InvalidGuildLicenseError);
  });

  it('validates hallmark audit records and enforces fineness boundaries', () => {
    const audit = HallmarkAuditRecord.create({
      id: 'hlm_1',
      tenantId: 'tenant_t1' as any,
      hallmarkCode: 'T750',
      labAuthority: 'Standard Assay Office of Tehran',
      verifiedFineness: 750,
      auditNotes: 'Standard 18K Tehran hallmark verified under spectrometer',
    });

    expect(audit.hallmarkCode).toBe('T750');
    expect(audit.verifiedFineness).toBe(750);

    // Invalid fineness
    expect(() =>
      HallmarkAuditRecord.create({
        id: 'hlm_inv',
        tenantId: 'tenant_t1' as any,
        hallmarkCode: 'T9999',
        labAuthority: 'Assay Lab',
        verifiedFineness: 1200, // Invalid > 999.9
      })
    ).toThrow(InvalidHallmarkAuditError);
  });

  it('manages customer review lifecycle and computes truthful trust score without synthetic inflation', () => {
    const review = CustomerReview.create({
      id: 'rev_1',
      tenantId: 'tenant_t1' as any,
      orderId: 'ord_123',
      customerId: 'usr_c1',
      sellerProfileId: 'seller_1',
      rating: 5,
      title: 'Authentic 18K Bangle',
      comment: 'Verified with local jeweler, pure 750 standard. Excellent craftsmanship!',
    });

    expect(review.moderationStatus).toBe('PENDING_REVIEW');
    review.approve('Verified authentic purchase and review');
    expect(review.moderationStatus).toBe('APPROVED');

    const license = GuildLicense.create({
      id: 'lic_1',
      tenantId: 'tenant_t1' as any,
      sellerProfileId: 'seller_1',
      guildRegistrationNumber: 'TEH-GOLD-998822',
      guildName: 'Tehran Guild',
      issuanceDate: new Date('2025-01-01'),
      expiryDate: new Date('2028-01-01'),
    });
    license.verify();

    const scoreBreakdown = TrustScoreCalculator.calculate({
      license,
      hallmarkAuditCount: 2, // 2 * 5 = 10 pts
      reviews: [review],      // 5 star = 30 pts + 2 volume = 32 pts
    });

    // Total: 40 (guild) + 10 (hallmarks) + 32 (reviews) = 82 pts -> GOLD tier
    expect(scoreBreakdown.guildVerified).toBe(true);
    expect(scoreBreakdown.hallmarkAuditCount).toBe(2);
    expect(scoreBreakdown.verifiedReviewCount).toBe(1);
    expect(scoreBreakdown.averageReviewRating).toBe(5);
    expect(scoreBreakdown.trustScore).toBe(82);
    expect(scoreBreakdown.trustTier).toBe('GOLD');
  });
});
