import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId, type ProductId, type ProductVariantId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getStudio3DContainer } from '@/lib/studio-3d/studio-3d-container';

const registerAssetSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().optional(),
  format: z.enum(['GLB', 'GLTF']),
  mimeType: z.string().min(1, 'mimeType is required'),
  fileSizeBytes: z.number().int().positive(),
  storageKey: z.string().min(1, 'storageKey is required'),
  boundingBox: z.object({
    widthMeters: z.number().positive(),
    heightMeters: z.number().positive(),
    depthMeters: z.number().positive(),
  }),
  material: z.object({
    metalnessFactor: z.number().min(0).max(1),
    roughnessFactor: z.number().min(0).max(1),
    baseColorHex: z.string().min(4),
    normalMapUrl: z.string().optional(),
    occlusionMapUrl: z.string().optional(),
    emissiveHex: z.string().optional(),
  }),
  lodLevels: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = registerAssetSchema.safeParse(rawBody);
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
    const container = getStudio3DContainer();

    const result = await container.studio3dService.registerAsset({
      tenantId: createEntityId<TenantId>(auth.tenantId),
      productId: createEntityId<ProductId>(data.productId),
      variantId: data.variantId ? createEntityId<ProductVariantId>(data.variantId) : undefined,
      format: data.format,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      storageKey: data.storageKey,
      boundingBox: data.boundingBox,
      material: data.material,
      lodLevels: data.lodLevels,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        asset: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/studio-3d/assets');
  }
}
