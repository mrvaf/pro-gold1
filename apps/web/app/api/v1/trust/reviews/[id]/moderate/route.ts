import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

const moderateReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = moderateReviewSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid moderation payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getTrustSafetyService();
    const updated = await service.moderateReview(
      id,
      auth.tenantId,
      parseResult.data.action,
      parseResult.data.notes
    );

    return NextResponse.json({
      success: true,
      data: updated.toJSON(),
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/reviews/[id]/moderate:POST');
  }
}
