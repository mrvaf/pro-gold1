import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { SellerStatus } from '@v-gold/core';

const updateSellerSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeId: z.string().nullable().optional(),
  displayName: z.string().min(2).max(255).optional(),
  bio: z.string().max(2000).optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  isPubliclyVisible: z.boolean().optional(),
  businessRegistrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  targetStatus: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  statusReason: z.string().optional(),
  actorId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
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

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.getSellerProfile(id, tenantId);

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

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const rawBody = await req.json();
    const parseRes = updateSellerSchema.safeParse(rawBody);

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

    // 1. If status transition requested
    if (data.targetStatus) {
      const transRes = await container.marketplaceService.transitionSellerStatus({
        id,
        tenantId: data.tenantId,
        targetStatus: data.targetStatus as SellerStatus,
        reason: data.statusReason,
        actorId: data.actorId,
      });

      if (transRes.isErr) {
        const err = transRes.error;
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
    }

    // 2. Profile attributes update
    const updateRes = await container.marketplaceService.updateSellerProfile({
      id,
      tenantId: data.tenantId,
      storeId: data.storeId === null ? '' : data.storeId,
      displayName: data.displayName,
      bio: data.bio,
      logoUrl: data.logoUrl,
      bannerUrl: data.bannerUrl,
      isPubliclyVisible: data.isPubliclyVisible,
      businessRegistrationNumber: data.businessRegistrationNumber,
      taxId: data.taxId,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      actorId: data.actorId,
    });

    if (updateRes.isErr) {
      const err = updateRes.error;
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
        data: updateRes.value.toDto(),
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
