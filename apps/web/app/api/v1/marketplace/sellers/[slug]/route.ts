import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }

    const { slug } = await props.params;

    if (!slug || slug.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Slug parameter is required.',
          },
        },
        { status: 400 }
      );
    }

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.getPublicSellerBySlug(slug);

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toPublicDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:marketplace/sellers/[slug]');
  }
}
