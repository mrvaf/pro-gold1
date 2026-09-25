import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryStatus } from '@v-gold/core';

const intakeItemSchema = z.object({
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
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'inventory.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
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
      tenantId: auth.tenantId,
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
      actorId: auth.actorId,
      notes: data.notes,
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
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/items');
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'inventory.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as InventoryStatus | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getInventoryContainer();
    const items = await container.inventoryService.listItems(auth.tenantId, {
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
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/items');
  }
}
