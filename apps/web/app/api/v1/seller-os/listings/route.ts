import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId, type ListingStatus } from '@v-gold/core';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.listings.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { tenantId } = auth;
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const status = url.searchParams.get('status') as ListingStatus | undefined;

    const container = getSellerOsContainer();

    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      const workspaces = await container.workspaceRepo.listByTenant(
        createEntityId<TenantId>(tenantId),
        { limit: 1 }
      );
      if (workspaces.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'No operational workspace found for this tenant.',
            },
          },
          { status: 404 }
        );
      }
      targetWorkspaceId = workspaces[0].id;
    }

    const result = await container.sellerOsService.listWorkspaceListings(
      targetWorkspaceId,
      tenantId,
      { status }
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.map((listing) => ({
          id: listing.id,
          tenantId: listing.tenantId,
          sellerProfileId: listing.sellerProfileId,
          productId: listing.productId,
          productVariantId: listing.productVariantId,
          title: listing.title,
          slug: listing.slug,
          description: listing.description,
          status: listing.status,
          visibility: listing.visibility,
          tags: listing.tags,
          createdAt: listing.audit.createdAt.toISOString(),
          updatedAt: listing.audit.updatedAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
