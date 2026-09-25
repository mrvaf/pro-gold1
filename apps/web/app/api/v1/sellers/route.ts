import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { SellerStatus } from '@v-gold/core';

const createSellerSchema = z.object({
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
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
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
      tenantId: auth.tenantId,
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
    return toErrorResponse(error, 'api:v1/sellers');
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as SellerStatus | null;
    const storeId = searchParams.get('storeId') as any;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const container = getMarketplaceContainer();
    const sellers = await container.marketplaceService.listSellerProfiles(auth.tenantId, {
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
  } catch (error) {
    return toErrorResponse(error, 'api:v1/sellers');
  }
}
