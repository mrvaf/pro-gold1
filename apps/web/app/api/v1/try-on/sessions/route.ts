import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createEntityId,
  type TenantId,
  type ProductId,
  type ProductVariantId,
  type Studio3DAssetId,
} from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTryOnContainer } from '@/lib/try-on/try-on-container';

const createSessionSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().optional(),
  asset3dId: z.string().min(1, 'asset3dId is required'),
  bodyPart: z.enum(['RING_FINGER', 'WRIST', 'EAR_LOBE', 'NECK']),
  scaleFactor: z.number().min(0.5).max(2.5).optional(),
  anchorOffset: z
    .object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
    .optional(),
  biometricFingerSizeMm: z.number().min(10).max(30).optional(),
  wristCircumferenceMm: z.number().min(100).max(300).optional(),
  durationSeconds: z.number().int().min(60).max(3600).optional(),
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

    const parseResult = createSessionSchema.safeParse(rawBody);
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
    const container = getTryOnContainer();

    const result = await container.tryOnService.createSession({
      tenantId: createEntityId<TenantId>(auth.tenantId),
      productId: createEntityId<ProductId>(data.productId),
      variantId: data.variantId ? createEntityId<ProductVariantId>(data.variantId) : undefined,
      asset3dId: createEntityId<Studio3DAssetId>(data.asset3dId),
      bodyPart: data.bodyPart,
      scaleFactor: data.scaleFactor,
      anchorOffset: data.anchorOffset,
      biometricFingerSizeMm: data.biometricFingerSizeMm,
      wristCircumferenceMm: data.wristCircumferenceMm,
      durationSeconds: data.durationSeconds,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        session: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/try-on/sessions');
  }
}
