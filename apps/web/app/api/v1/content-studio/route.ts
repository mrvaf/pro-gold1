import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getContentStudioService } from '@/lib/content-studio/content-studio-container';

const createContentAssetSchema = z.object({
  productId: z.string().optional(),
  contentType: z.enum(['PRODUCT_DESCRIPTION', 'SOCIAL_CAPTION', 'CERTIFICATE_OF_AUTHENTICITY']),
  language: z.enum(['fa-IR', 'en-US', 'ar-AE']).default('fa-IR'),
  headline: z.string().min(1, 'Headline is required'),
  body: z.string().min(1, 'Body text is required'),
  tags: z.array(z.string()).optional(),
  groundingAttributes: z.object({
    title: z.string().min(1),
    targetKarat: z.number().int().min(9).max(24).optional(),
    weightGrams: z.number().positive().optional(),
    gemstone: z.string().optional(),
    metalType: z.string().min(1),
  }),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    const service = getContentStudioService();
    const assets = productId
      ? await service.listByProduct(productId, auth.tenantId)
      : await service.listByTenant(auth.tenantId);

    return NextResponse.json(
      {
        success: true,
        contentAssets: assets.map((a) => a.toJSON()),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}

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

    const parseResult = createContentAssetSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid content studio generation parameters',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const service = getContentStudioService();
    const asset = await service.generateAndSaveContent({
      ...parseResult.data,
      tenantId: auth.tenantId,
    });

    return NextResponse.json(
      {
        success: true,
        contentAsset: asset.toJSON(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
