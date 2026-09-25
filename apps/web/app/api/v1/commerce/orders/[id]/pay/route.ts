import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getCommerceService } from '@/lib/commerce/commerce-container';

const paymentSchema = z.object({
  provider: z.enum(['MOCK_GATEWAY', 'ZARINPAL', 'STRIPE']).default('MOCK_GATEWAY'),
  paymentReferenceToken: z.string().min(1, 'Payment reference token is required'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    const { id: orderId } = await params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = paymentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment payload',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const service = getCommerceService();
    const order = await service.processPayment({
      orderId,
      tenantId: auth.tenantId,
      provider: parseResult.data.provider,
      paymentReferenceToken: parseResult.data.paymentReferenceToken,
    });

    return NextResponse.json(
      {
        success: true,
        order: order.toJSON(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
