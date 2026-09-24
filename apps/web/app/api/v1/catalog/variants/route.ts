import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import type { JewelryType, ProductVariantStatus } from '@v-gold/core';

const gemstoneSchema = z.object({
  gemstoneType: z.enum(['DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'OTHER']),
  caratWeight: z.union([z.string(), z.number()]),
  count: z.number().int().positive().optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  cut: z.string().optional(),
  certificateNumber: z.string().optional(),
  description: z.string().optional(),
});

const createVariantSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  tenantId: z.string().min(1, 'tenantId is required'),
  sku: z.string().min(3).max(64),
  name: z.string().min(2).max(255),
  jewelryType: z.enum([
    'RING',
    'NECKLACE',
    'BRACELET',
    'EARRINGS',
    'PENDANT',
    'BULLION',
    'COIN',
    'OTHER',
  ]),
  goldPurity: z
    .object({
      fineness: z.union([z.string(), z.number()]).optional(),
      karat: z.union([z.string(), z.number()]).optional(),
    })
    .refine((p) => p.fineness !== undefined || p.karat !== undefined, {
      message: 'Either fineness or karat must be specified.',
    }),
  goldWeightGrams: z.union([z.string(), z.number()]),
  grossWeightGrams: z.union([z.string(), z.number()]),
  gemstones: z.array(gemstoneSchema).optional(),
  pricingRuleId: z.string().optional(),
  actorId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseRes = createVariantSchema.safeParse(rawBody);

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
    const result = await container.catalogService.createVariant({
      productId: data.productId,
      tenantId: data.tenantId,
      sku: data.sku,
      name: data.name,
      jewelryType: data.jewelryType as JewelryType,
      goldPurity: data.goldPurity,
      goldWeightGrams: data.goldWeightGrams,
      grossWeightGrams: data.grossWeightGrams,
      gemstones: data.gemstones as any,
      pricingRuleId: data.pricingRuleId,
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

    const productId = searchParams.get('productId');
    const container = getCatalogContainer();

    if (productId) {
      const variants = await container.catalogService.listVariantsByProduct(productId, tenantId);
      return NextResponse.json(
        {
          success: true,
          data: variants.map((v) => v.toDto()),
        },
        { status: 200 }
      );
    }

    const status = searchParams.get('status') as ProductVariantStatus | null;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const variants = await container.catalogService.listVariants(tenantId, {
      status: status ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: variants.map((v) => v.toDto()),
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
