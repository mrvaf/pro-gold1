import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { SellerStatus } from '@v-gold/core';

const createSellerSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeId: z.string().optional(),
  displayName: z.string().min(2, 'Display name must have at least 2 characters').max(255),
  slug: z.string().min(3).max(64),
  bio: z.string().max(2000).optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  isPubliclyVisible: z.boolean().optional(),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  initialStatus: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  actorId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseRes = createSellerSchema.safeParse(rawBody);

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
    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.createSellerProfile({
      tenantId: data.tenantId,
      storeId: data.storeId,
      displayName: data.displayName,
      slug: data.slug,
      bio: data.bio,
      logoUrl: data.logoUrl,
      bannerUrl: data.bannerUrl,
      isPubliclyVisible: data.isPubliclyVisible,
      businessRegistrationNumber: data.businessRegistrationNumber,
      taxId: data.taxId,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      metadata: data.metadata,
      initialStatus: data.initialStatus as SellerStatus | undefined,
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

    const status = searchParams.get('status') as SellerStatus | null;
    const storeId = searchParams.get('storeId') as any;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getMarketplaceContainer();
    const sellers = await container.marketplaceService.listSellerProfiles(tenantId, {
      status: status ?? undefined,
      storeId: storeId ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: sellers.map((s) => s.toDto()),
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
