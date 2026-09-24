import { NextRequest, NextResponse } from 'next/server';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const itemId = searchParams.get('itemId');

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

    const container = getInventoryContainer();

    if (itemId) {
      const movements = await container.inventoryService.listMovements(itemId, tenantId);
      return NextResponse.json(
        {
          success: true,
          data: movements.map((m) => m.toDto()),
        },
        { status: 200 }
      );
    }

    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const movements = await container.movementRepo.listByTenant(tenantId as any, {
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: movements.map((m) => m.toDto()),
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
