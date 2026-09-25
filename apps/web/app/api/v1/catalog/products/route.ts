import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import type { JewelryType, ProductStatus } from '@v-gold/core';

const createProductSchema = z.object({
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
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
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
      tenantId: auth.tenantId,
      storeId: data.storeId,
      name: data.name,
      description: data.description,
      productType: data.productType as JewelryType,
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
    return toErrorResponse(error, 'api:v1/catalog/products');
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as ProductStatus | null;
    const productType = searchParams.get('productType') as JewelryType | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getCatalogContainer();
    const products = await container.catalogService.listProducts(auth.tenantId, {
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
  } catch (error) {
    return toErrorResponse(error, 'api:v1/catalog/products');
  }
}
