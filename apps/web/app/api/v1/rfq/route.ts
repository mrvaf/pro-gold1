import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId, type UserId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getRfqContainer } from '@/lib/rfq/rfq-container';

const createRfqSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  jewelryType: z.enum(['RING', 'NECKLACE', 'BRACELET', 'EARRINGS', 'PENDANT', 'BULLION', 'COIN', 'OTHER']),
  targetMetal: z.enum(['GOLD', 'PLATINUM', 'SILVER']),
  targetKarat: z.number().int().min(9).max(24).optional(),
  estimatedWeightGrams: z.string().optional(),
  referenceAssetUrl: z.string().optional(),
  targetBudget: z.string().optional(),
  currency: z.enum(['IRR', 'TOMAN', 'USD', 'EUR']).optional(),
  sellerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = createRfqSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body schema.',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseResult;
    const container = getRfqContainer();

    const result = await container.rfqService.createRfq({
      tenantId: createEntityId<TenantId>(auth.tenantId),
      customerId: createEntityId<UserId>(auth.actorId),
      sellerId: data.sellerId ? createEntityId<UserId>(data.sellerId) : undefined,
      title: data.title,
      description: data.description,
      jewelryType: data.jewelryType,
      targetMetal: data.targetMetal,
      targetKarat: data.targetKarat,
      estimatedWeightGrams: data.estimatedWeightGrams,
      referenceAssetUrl: data.referenceAssetUrl,
      targetBudgetAmount: data.targetBudget,
      currency: data.currency,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        rfq: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/rfq');
  }
}
