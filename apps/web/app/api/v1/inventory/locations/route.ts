import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryLocationType, InventoryLocationStatus } from '@v-gold/core';

const createLocationSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeId: z.string().optional(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(64),
  type: z.enum([
    'STORE_FRONT',
    'VAULT',
    'DISPLAY',
    'WORKSHOP',
    'WAREHOUSE',
    'IN_TRANSIT',
    'OTHER',
  ]),
  actorId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseRes = createLocationSchema.safeParse(rawBody);

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
    const result = await container.inventoryService.createLocation({
      tenantId: data.tenantId,
      storeId: data.storeId,
      name: data.name,
      code: data.code,
      type: data.type as InventoryLocationType,
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

export async function GET(req: NextRequest) {
  try {
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

    const status = searchParams.get('status') as InventoryLocationStatus | null;
    const container = getInventoryContainer();
    const locations = await container.inventoryService.listLocations(tenantId, {
      status: status ?? undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: locations.map((l) => l.toDto()),
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
