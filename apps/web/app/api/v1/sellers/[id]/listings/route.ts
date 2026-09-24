import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { ListingStatus, ListingVisibility } from '@v-gold/core';

const createListingSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  productId: z.string().min(1, 'productId is required'),
  productVariantId: z.string().min(1, 'productVariantId is required'),
  title: z.string().min(3, 'Listing title must have at least 3 characters').max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  initialStatus: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'HIDDEN']).optional(),
  tags: z.array(z.string()).optional(),
  actorId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerProfileId } = await props.params;
    const rawBody = await req.json();
    const parseRes = createListingSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload schema.',
            details: parseRes.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseRes;
    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.createListing({
      tenantId: data.tenantId,
      sellerProfileId,
      productId: data.productId,
      productVariantId: data.productVariantId,
      title: data.title,
      slug: data.slug,
      description: data.description,
      initialStatus: data.initialStatus as ListingStatus | undefined,
      visibility: data.visibility as ListingVisibility | undefined,
      tags: data.tags,
      actorId: data.actorId,
    });

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
        data: result.value.toDto(),
      },
      { status: 201 }
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

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerProfileId } = await props.params;
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameter "tenantId" is required for multi-tenant isolation.',
          },
        },
        { status: 400 }
      );
    }

    const status = searchParams.get('status') as ListingStatus | null;
    const visibility = searchParams.get('visibility') as ListingVisibility | null;
    const productId = searchParams.get('productId') as any;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.listListingsBySeller(
      sellerProfileId,
      tenantId,
      {
        status: status ?? undefined,
        visibility: visibility ?? undefined,
        productId: productId ?? undefined,
        limit,
        offset,
      }
    );

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
        data: result.value.map((l) => l.toDto()),
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
