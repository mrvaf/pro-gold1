import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

const submitReviewSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  sellerProfileId: z.string().min(1, 'Seller profile ID is required'),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1, 'Title is required'),
  comment: z.string().min(1, 'Comment is required'),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'tenant.read');
    if (!auth.ok) {
      return auth.response;
    }

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

    const parseResult = submitReviewSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid review payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getTrustSafetyService();
    const review = await service.submitCustomerReview({
      tenantId: auth.tenantId,
      customerId: auth.actorId,
      orderId: parseResult.data.orderId,
      sellerProfileId: parseResult.data.sellerProfileId,
      rating: parseResult.data.rating,
      title: parseResult.data.title,
      comment: parseResult.data.comment,
      isVerifiedPurchase: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: review.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/reviews:POST');
  }
}
