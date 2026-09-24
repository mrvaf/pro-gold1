import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';
import type { WorkspaceStatus } from '@v-gold/core';

const transitionSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  targetStatus: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const parseRes = transitionSchema.safeParse(rawBody);

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
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.transitionWorkspaceStatus(
      data.workspaceId,
      auth.tenantId,
      data.targetStatus as WorkspaceStatus,
      auth.identity.user.id,
      data.reason
    );

    if (result.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: result.error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
