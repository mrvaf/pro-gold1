import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId } from '@v-gold/core';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.os.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { tenantId } = auth;
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const sellerProfileId = url.searchParams.get('sellerProfileId');

    const container = getSellerOsContainer();

    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      if (sellerProfileId) {
        const wsRes = await container.sellerOsService.getWorkspaceBySeller(sellerProfileId, tenantId);
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
        targetWorkspaceId = wsRes.value.id;
      } else {
        // Fallback: fetch the first workspace for this tenant
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
    }

    const overviewRes = await container.sellerOsService.getOperationalOverview(
      targetWorkspaceId,
      tenantId
    );

    if (overviewRes.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: overviewRes.error.code,
            message: overviewRes.error.message,
          },
        },
        { status: overviewRes.error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: overviewRes.value,
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
