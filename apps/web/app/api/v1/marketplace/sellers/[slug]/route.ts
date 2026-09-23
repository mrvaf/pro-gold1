import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
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
      const err = result.error;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toPublicDto(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message ?? 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
