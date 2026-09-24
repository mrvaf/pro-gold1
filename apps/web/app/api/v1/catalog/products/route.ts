import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import type { JewelryType, ProductStatus } from '@v-gold/core';

const createProductSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeId: z.string().optional(),
  name: z.string().min(2, 'Product name must have at least 2 characters').max(255),
  description: z.string().optional(),
  productType: z.enum([
    'RING',
    'NECKLACE',
    'BRACELET',
    'EARRINGS',
    'PENDANT',
    'BULLION',
    'COIN',
    'OTHER',
  ]),
  actorId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseRes = createProductSchema.safeParse(rawBody);

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
    const container = getCatalogContainer();
    const result = await container.catalogService.createProduct({
      tenantId: data.tenantId,
      storeId: data.storeId,
      name: data.name,
      description: data.description,
      productType: data.productType as JewelryType,
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

    const status = searchParams.get('status') as ProductStatus | null;
    const productType = searchParams.get('productType') as JewelryType | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getCatalogContainer();
    const products = await container.catalogService.listProducts(tenantId, {
      status: status ?? undefined,
      productType: productType ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: products.map((p) => p.toDto()),
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
