import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getCommerceService } from '@/lib/commerce/commerce-container';

const addToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.string().min(1),
  currency: z.enum(['USD', 'EUR', 'IRR', 'TOMAN']).default('USD'),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    const service = getCommerceService();
    const cart = await service.getOrCreateCart(auth.tenantId, auth.actorId);

    return NextResponse.json(
      {
        success: true,
        cart: cart.toJSON(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = addToCartSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid add to cart payload',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const service = getCommerceService();
    const cart = await service.addItemToCart({
      ...parseResult.data,
      tenantId: auth.tenantId,
      userId: auth.actorId,
    });

    return NextResponse.json(
      {
        success: true,
        cart: cart.toJSON(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
