import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import type { WorkspaceStatus } from '@v-gold/core';

const transitionSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  targetStatus: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = transitionSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.transitionWorkspaceStatus(
      data.workspaceId,
      auth.tenantId,
      data.targetStatus as WorkspaceStatus,
      auth.identity.user.id,
      data.reason
    );

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
    return toErrorResponse(error);
  }
}
