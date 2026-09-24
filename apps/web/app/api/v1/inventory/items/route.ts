import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryStatus } from '@v-gold/core';

const intakeItemSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeId: z.string().optional(),
  productVariantId: z.string().min(1, 'productVariantId is required'),
  sku: z.string().min(3).max(64).optional(),
  locationId: z.string().min(1, 'locationId is required'),
  serialNumber: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  grossWeightGrams: z.union([z.string(), z.number()]),
  goldWeightGrams: z.union([z.string(), z.number()]),
  purityFineness: z.union([z.string(), z.number()]),
  passportRef: z.string().optional(),
  actorId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseRes = intakeItemSchema.safeParse(rawBody);

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
    const result = await container.inventoryService.intakeItem({
      tenantId: data.tenantId,
      storeId: data.storeId,
      productVariantId: data.productVariantId,
      sku: data.sku,
      locationId: data.locationId,
      serialNumber: data.serialNumber,
      barcode: data.barcode,
      quantity: data.quantity,
      grossWeightGrams: data.grossWeightGrams,
      goldWeightGrams: data.goldWeightGrams,
      purityFineness: data.purityFineness,
      passportRef: data.passportRef,
      actorId: data.actorId,
      notes: data.notes,
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

    const status = searchParams.get('status') as InventoryStatus | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getInventoryContainer();
    const items = await container.inventoryService.listItems(tenantId, {
      status: status ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: items.map((i) => i.toDto()),
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
