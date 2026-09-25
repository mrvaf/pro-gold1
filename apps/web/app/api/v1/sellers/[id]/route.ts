import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { SellerStatus } from '@v-gold/core';

const updateSellerSchema = z.object({
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
});

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await props.params;

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.getSellerProfile(id, auth.tenantId);

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/sellers/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await props.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
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
        tenantId: auth.tenantId,
        targetStatus: data.targetStatus as SellerStatus,
        reason: data.statusReason,
        actorId: auth.actorId,
      });

      if (transRes.isErr) {
        return toErrorResponse(transRes.error);
      }
    }

    // 2. Profile attributes update
    const updateRes = await container.marketplaceService.updateSellerProfile({
      id,
      tenantId: auth.tenantId,
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
      actorId: auth.actorId,
    });

    if (updateRes.isErr) {
      return toErrorResponse(updateRes.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: updateRes.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/sellers/[id]');
  }
}
