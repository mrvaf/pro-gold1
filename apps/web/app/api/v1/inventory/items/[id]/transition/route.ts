import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryStatus } from '@v-gold/core';

const transitionSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  targetStatus: z.enum([
    'AVAILABLE',
    'RESERVED',
    'SOLD',
    'DAMAGED',
    'LOST',
    'IN_TRANSIT',
  ]),
  actorId: z.string().optional(),
  reason: z.string().optional(),
  reference: z.string().optional(),
  toLocationId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const rawBody = await req.json();
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
      tenantId: data.tenantId,
      targetStatus: data.targetStatus as InventoryStatus,
      actorId: data.actorId,
      reason: data.reason,
      reference: data.reference,
      toLocationId: data.toLocationId,
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
        data: {
          item: result.value.item.toDto(),
          movement: result.value.movement.toDto(),
        },
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
