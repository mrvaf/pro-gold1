import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getPackagingService } from '@/lib/packaging/packaging-container';

const createPackagingSchema = z.object({
  name: z.string().min(1, 'Packaging name is required'),
  productId: z.string().optional(),
  dimensions: z.object({
    widthMm: z.number().min(20).max(500),
    lengthMm: z.number().min(20).max(500),
    heightMm: z.number().min(10).max(300),
  }),
  material: z.enum(['LEATHER', 'VELVET', 'SOLID_WOOD', 'HARDCOVER_PAPER', 'LACQUERED_WOOD']),
  tier: z.enum(['STANDARD', 'PREMIUM', 'BESPOKE_LUXURY']),
  primaryColorHex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Valid HEX color required'),
  accentColorHex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  hasCustomDieline: z.boolean().optional(),
  hasFoilEmbossing: z.boolean().optional(),
  dieline: z
    .object({
      fluteOrBoardThicknessMm: z.number().positive(),
      creasingMatrixMm: z.number().positive(),
      insertCushionType: z.enum(['FOAM_SLOT', 'VELVET_PILLOW', 'RING_CLIP', 'PENDANT_GROOVE']),
    })
    .optional(),
  currency: z.enum(['USD', 'EUR', 'IRR', 'TOMAN']).optional(),
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

    const parseResult = createPackagingSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid packaging specification parameters',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const service = getPackagingService();
    const spec = await service.createSpecification({
      ...parseResult.data,
      tenantId: auth.tenantId,
    });

    return NextResponse.json(
      {
        success: true,
        packaging: spec.toJSON(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    const service = getPackagingService();
    const items = productId
      ? await service.listByProduct(productId, auth.tenantId)
      : await service.listSpecifications(auth.tenantId);

    return NextResponse.json(
      {
        success: true,
        packagingSpecifications: items.map((s) => s.toJSON()),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
