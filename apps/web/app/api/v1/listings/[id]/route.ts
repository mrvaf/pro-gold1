import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import type { ListingStatus, ListingVisibility } from '@v-gold/core';

const updateListingSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'HIDDEN']).optional(),
  targetStatus: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  statusReason: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.listing.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await props.params;

    const container = getMarketplaceContainer();
    const result = await container.marketplaceService.getListing(id, auth.tenantId);

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
    return toErrorResponse(error, 'api:v1/listings/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.listing.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await props.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = updateListingSchema.safeParse(rawBody);

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
      const transRes = await container.marketplaceService.transitionListingStatus({
        id,
        tenantId: auth.tenantId,
        targetStatus: data.targetStatus as ListingStatus,
        reason: data.statusReason,
        actorId: auth.actorId,
      });

      if (transRes.isErr) {
        return toErrorResponse(transRes.error);
      }
    }

    // 2. Display attributes update
    const updateRes = await container.marketplaceService.updateListing({
      id,
      tenantId: auth.tenantId,
      title: data.title,
      description: data.description,
      tags: data.tags,
      visibility: data.visibility as ListingVisibility | undefined,
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
    return toErrorResponse(error, 'api:v1/listings/[id]');
  }
}
