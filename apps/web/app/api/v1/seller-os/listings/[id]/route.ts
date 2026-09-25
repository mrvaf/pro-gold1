import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
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
    const auth = await authenticateRequest(req, 'seller.listings.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: listingId } = await context.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = updateListingSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();
    const marketplaceContainer = getMarketplaceContainer();

    // 1. Verify workspace exists and belongs to tenant
    const wsRes = await container.sellerOsService.getWorkspaceById(data.workspaceId, auth.tenantId);
    if (wsRes.isErr) {
      return toErrorResponse(wsRes.error);
    }
    const ws = wsRes.value;

    // 2. Verify listing belongs to this workspace's seller profile and tenant
    const listingRes = await marketplaceContainer.marketplaceService.getListing(
      listingId,
      auth.tenantId
    );
    if (listingRes.isErr) {
      return toErrorResponse(listingRes.error);
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
        return toErrorResponse(updateRes.error);
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
        return toErrorResponse(transRes.error);
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
  } catch (error) {
    return toErrorResponse(error);
  }
}
