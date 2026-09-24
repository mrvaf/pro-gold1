import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { ListingStatus, ListingVisibility } from '@v-gold/core';

const updateListingSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  targetStatus: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(4000).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.listings.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: listingId } = await context.params;
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
    const container = getSellerOsContainer();
    const marketplaceContainer = getMarketplaceContainer();

    // 1. Verify workspace exists and belongs to tenant
    const wsRes = await container.sellerOsService.getWorkspaceById(data.workspaceId, auth.tenantId);
    if (wsRes.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: wsRes.error.code,
            message: wsRes.error.message,
          },
        },
        { status: wsRes.error.httpStatus }
      );
    }
    const ws = wsRes.value;

    // 2. Verify listing belongs to this workspace's seller profile and tenant
    const listingRes = await marketplaceContainer.marketplaceService.getListing(
      listingId,
      auth.tenantId
    );
    if (listingRes.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: listingRes.error.code,
            message: listingRes.error.message,
          },
        },
        { status: listingRes.error.httpStatus }
      );
    }
    const listing = listingRes.value;

    if (listing.sellerProfileId !== ws.sellerProfileId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Listing does not belong to the seller profile associated with this workspace.',
          },
        },
        { status: 403 }
      );
    }

    // 3. Update display fields if provided
    if (data.title !== undefined || data.description !== undefined || data.visibility !== undefined) {
      const updateRes = await marketplaceContainer.marketplaceService.updateListing({
        id: listingId,
        tenantId: auth.tenantId,
        title: data.title,
        description: data.description,
        visibility: data.visibility as ListingVisibility | undefined,
        actorId: auth.identity.user.id,
      });

      if (updateRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: updateRes.error.code,
              message: updateRes.error.message,
            },
          },
          { status: updateRes.error.httpStatus }
        );
      }
    }

    // 4. Update status if provided
    if (data.targetStatus) {
      const transRes = await marketplaceContainer.marketplaceService.transitionListingStatus({
        id: listingId,
        tenantId: auth.tenantId,
        targetStatus: data.targetStatus as ListingStatus,
        actorId: auth.identity.user.id,
      });

      if (transRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: transRes.error.code,
              message: transRes.error.message,
            },
          },
          { status: transRes.error.httpStatus }
        );
      }
    }

    // Return updated listing
    const updated = await marketplaceContainer.listingRepo.findById(listingId as any, auth.tenantId as any);

    return NextResponse.json(
      {
        success: true,
        data: updated
          ? {
              id: updated.id,
              tenantId: updated.tenantId,
              sellerProfileId: updated.sellerProfileId,
              title: updated.title,
              status: updated.status,
              visibility: updated.visibility,
              updatedAt: updated.audit.updatedAt.toISOString(),
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
