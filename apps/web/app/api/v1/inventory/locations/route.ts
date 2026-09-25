import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import type { InventoryLocationType, InventoryLocationStatus } from '@v-gold/core';

const createLocationSchema = z.object({
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
      tenantId: auth.tenantId,
      storeId: data.storeId,
      name: data.name,
      code: data.code,
      type: data.type as InventoryLocationType,
      actorId: auth.actorId,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/locations');
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'inventory.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as InventoryLocationStatus | null;
    const container = getInventoryContainer();
    const locations = await container.inventoryService.listLocations(auth.tenantId, {
      status: status ?? undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: locations.map((l) => l.toDto()),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/locations');
  }
}
