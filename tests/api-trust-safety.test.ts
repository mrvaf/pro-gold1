import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as licensesPost } from '@/app/api/v1/trust/licenses/route';
import { POST as verifyLicensePost } from '@/app/api/v1/trust/licenses/[id]/verify/route';
import { POST as hallmarksPost } from '@/app/api/v1/trust/hallmarks/route';
import { POST as reviewsPost } from '@/app/api/v1/trust/reviews/route';
import { POST as moderateReviewPost } from '@/app/api/v1/trust/reviews/[id]/moderate/route';
import { GET as trustScoreGet } from '@/app/api/v1/trust/scores/[sellerId]/route';
import * as authModule from '@/lib/auth/request-auth';

describe('Stage 20 — Trust, Safety & Seller Verification REST API', () => {
  it('manages guild license submission, hallmark recording, review moderation, and trust score calculation', async () => {
    vi.spyOn(authModule, 'authenticateRequest').mockResolvedValue({
      ok: true,
      tenantId: 'tenant_trust_1',
      actorId: 'usr_trust_1',
      identity: {} as any,
      membership: {} as any,
    });

    // 1. Submit Guild License
    const reqLic = new NextRequest('http://localhost:3000/api/v1/trust/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerProfileId: 'seller_trust_1',
        guildRegistrationNumber: 'TEH-GUILD-88899',
        guildName: 'Tehran Gold Guild',
        issuanceDate: new Date('2025-01-01').toISOString(),
        expiryDate: new Date('2028-01-01').toISOString(),
      }),
    });

    const resLic = await licensesPost(reqLic);
    expect(resLic.status).toBe(201);
    const licJson = await resLic.json();
    expect(licJson.success).toBe(true);
    expect(licJson.data.status).toBe('PENDING');

    const licenseId = licJson.data.id;

    // 2. Verify Guild License
    const reqVerify = new NextRequest(`http://localhost:3000/api/v1/trust/licenses/${licenseId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VERIFY' }),
    });

    const resVerify = await verifyLicensePost(reqVerify, {
      params: Promise.resolve({ id: licenseId }),
    });
    expect(resVerify.status).toBe(200);
    const verifyJson = await resVerify.json();
    expect(verifyJson.data.status).toBe('VERIFIED');

    // 3. Record Hallmark Audit
    const reqHlm = new NextRequest('http://localhost:3000/api/v1/trust/hallmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hallmarkCode: 'T750',
        labAuthority: 'National Assay Authority',
        verifiedFineness: 750,
        auditNotes: 'Spectrometer purity test verified',
      }),
    });

    const resHlm = await hallmarksPost(reqHlm);
    expect(resHlm.status).toBe(201);
    const hlmJson = await resHlm.json();
    expect(hlmJson.success).toBe(true);

    // 4. Submit & Moderate Customer Review
    const reqRev = new NextRequest('http://localhost:3000/api/v1/trust/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_trust_1',
        sellerProfileId: 'seller_trust_1',
        rating: 5,
        title: 'Authentic Hallmark',
        comment: 'Verified with Tehran union hallmark code.',
      }),
    });

    const resRev = await reviewsPost(reqRev);
    expect(resRev.status).toBe(201);
    const revJson = await resRev.json();
    expect(revJson.data.moderationStatus).toBe('PENDING_REVIEW');

    const reviewId = revJson.data.id;

    // Moderate Review
    const reqMod = new NextRequest(`http://localhost:3000/api/v1/trust/reviews/${reviewId}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'APPROVE', notes: 'Verified purchase receipt' }),
    });

    const resMod = await moderateReviewPost(reqMod, {
      params: Promise.resolve({ id: reviewId }),
    });
    expect(resMod.status).toBe(200);
    const modJson = await resMod.json();
    expect(modJson.data.moderationStatus).toBe('APPROVED');

    // 5. Query Real-Time Trust Score Breakdown
    const reqScore = new NextRequest('http://localhost:3000/api/v1/trust/scores/seller_trust_1', {
      method: 'GET',
    });

    const resScore = await trustScoreGet(reqScore, {
      params: Promise.resolve({ sellerId: 'seller_trust_1' }),
    });
    expect(resScore.status).toBe(200);
    const scoreJson = await resScore.json();
    expect(scoreJson.success).toBe(true);
    expect(scoreJson.data.guildVerified).toBe(true);
    expect(scoreJson.data.hallmarkAuditCount).toBe(1);
    expect(scoreJson.data.verifiedReviewCount).toBe(1);
    expect(scoreJson.data.trustScore).toBeGreaterThanOrEqual(70);
  });
});
