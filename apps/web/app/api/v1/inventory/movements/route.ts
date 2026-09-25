import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';

const movementsQuerySchema = z.object({
  itemId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'inventory.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const parseRes = movementsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parseRes.success) {
      return validationErrorResponse('Invalid query parameters.', parseRes.error.format());
    }

    const { itemId, limit, offset } = parseRes.data;
    const container = getInventoryContainer();

    if (itemId) {
      const movements = await container.inventoryService.listMovements(itemId, auth.tenantId);
      return NextResponse.json(
        {
          success: true,
          data: movements.map((m) => m.toDto()),
        },
        { status: 200 }
      );
    }

    const tenantMovements = await container.inventoryService.listMovementsByTenant(auth.tenantId, {
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: tenantMovements.map((m) => m.toDto()),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/inventory/movements');
  }
}
