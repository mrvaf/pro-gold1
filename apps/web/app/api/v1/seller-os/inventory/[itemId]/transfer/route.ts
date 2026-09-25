import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

const transferSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  toLocationId: z.string().min(1, 'toLocationId is required'),
  reference: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'seller.inventory.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { itemId } = await context.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = transferSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.transferInventoryItem({
      tenantId: auth.tenantId,
      workspaceId: data.workspaceId,
      itemId,
      toLocationId: data.toLocationId,
      reference: data.reference,
      reason: data.reason,
      actorId: auth.identity.user.id,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    const { item, movement } = result.value;
    return NextResponse.json(
      {
        success: true,
        data: {
          item: {
            id: item.id,
            tenantId: item.tenantId,
            locationId: item.locationId,
            status: item.status,
            updatedAt: item.audit.updatedAt.toISOString(),
          },
          movement: {
            id: movement.id,
            movementType: movement.movementType,
            fromLocationId: movement.fromLocationId,
            toLocationId: movement.toLocationId,
            quantity: movement.quantity.toString(),
            occurredAt: movement.occurredAt.toISOString(),
            reference: movement.reference,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
