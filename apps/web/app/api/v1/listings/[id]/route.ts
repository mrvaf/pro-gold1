import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { ListingStatus, ListingVisibility } from '@v-gold/core';

const updateListingSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'HIDDEN']).optional(),
  targetStatus: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  statusReason: z.string().optional(),
  actorId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
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

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.getListing(id, tenantId);

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

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const rawBody = await req.json();
    const parseRes = updateListingSchema.safeParse(rawBody);

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

    // 1. If status transition requested
    if (data.targetStatus) {
      const transRes = await container.marketplaceService.transitionListingStatus({
        id,
        tenantId: data.tenantId,
        targetStatus: data.targetStatus as ListingStatus,
        reason: data.statusReason,
        actorId: data.actorId,
      });

      if (transRes.isErr) {
        const err = transRes.error;
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
    }

    // 2. Display attributes update
    const updateRes = await container.marketplaceService.updateListing({
      id,
      tenantId: data.tenantId,
      title: data.title,
      description: data.description,
      tags: data.tags,
      visibility: data.visibility as ListingVisibility | undefined,
      actorId: data.actorId,
    });

    if (updateRes.isErr) {
      const err = updateRes.error;
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
        data: updateRes.value.toDto(),
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
