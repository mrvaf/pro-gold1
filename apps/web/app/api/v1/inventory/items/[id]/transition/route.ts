import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryStatus } from '@v-gold/core';

const transitionSchema = z.object({
  targetStatus: z.enum([
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'DAMAGED',
    'LOST',
    'IN_TRANSIT',
  ]),
  reason: z.string().optional(),
  reference: z.string().optional(),
  toLocationId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'inventory.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await props.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = transitionSchema.safeParse(rawBody);

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
    const container = getInventoryContainer();

    const result = await container.inventoryService.transitionStatus({
      itemId: id,
      tenantId: auth.tenantId,
      targetStatus: data.targetStatus as InventoryStatus,
      actorId: auth.actorId,
      reason: data.reason,
      reference: data.reference,
      toLocationId: data.toLocationId,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          item: result.value.item.toDto(),
          movement: result.value.movement.toDto(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/items/[id]/transition');
  }
}
