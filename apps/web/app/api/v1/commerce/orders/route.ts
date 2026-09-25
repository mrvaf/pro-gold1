import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getCommerceService } from '@/lib/commerce/commerce-container';

const checkoutSchema = z.object({
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    let idempotencyKey: string | undefined;
    const rawText = await req.text();
    if (rawText && rawText.trim().length > 0) {
      const rawBody = JSON.parse(rawText);
      const identityViolation = rejectIdentityInput(req, rawBody);
      if (identityViolation) {
        return identityViolation;
      }
      const parseResult = checkoutSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid checkout parameters',
              details: parseResult.error.format(),
            },
          },
          { status: 400 }
        );
      }
      idempotencyKey = parseResult.data.idempotencyKey;
    }

    const service = getCommerceService();
    const order = await service.checkoutCart({
      tenantId: auth.tenantId,
      userId: auth.actorId,
      idempotencyKey,
    });

    return NextResponse.json(
      {
        success: true,
        order: order.toJSON(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    const service = getCommerceService();
    const orders = await service.listUserOrders(auth.actorId, auth.tenantId);

    return NextResponse.json(
      {
        success: true,
        orders: orders.map((o) => o.toJSON()),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
