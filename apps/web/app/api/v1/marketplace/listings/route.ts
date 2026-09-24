import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import { createEntityId, type SellerProfileId } from '@v-gold/core';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sellerProfileId = searchParams.get('sellerProfileId');
    const tag = searchParams.get('tag');
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getMarketplaceContainer();
    const listings = await container.marketplaceService.listPublicListings({
      sellerProfileId: sellerProfileId ? createEntityId<SellerProfileId>(sellerProfileId) : undefined,
      tag: tag ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: listings.map((l) => l.toPublicDto()),
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
