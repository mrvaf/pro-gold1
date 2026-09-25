import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId, type InventoryStatus } from '@v-gold/core';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.inventory.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { tenantId } = auth;
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const status = url.searchParams.get('status') as InventoryStatus | undefined;
    const locationId = url.searchParams.get('locationId') || undefined;

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

    const result = await container.sellerOsService.listWorkspaceInventory(
      targetWorkspaceId,
      tenantId,
      { status, locationId }
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.map((item) => ({
          id: item.id,
          tenantId: item.tenantId,
          storeId: item.storeId,
          productVariantId: item.productVariantId,
          sku: item.sku.value,
          serialNumber: item.serialNumber,
          barcode: item.barcode,
          locationId: item.locationId,
          status: item.status,
          quantity: item.quantity.toString(),
          grossWeightGrams: item.grossWeight.grams.toString(),
          goldWeightGrams: item.goldWeight.grams.toString(),
          purityFineness: item.purity.fineness.toString(),
          passportRef: item.passportRef,
          createdAt: item.audit.createdAt.toISOString(),
          updatedAt: item.audit.updatedAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
