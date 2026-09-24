import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';
import type { Role, MembershipStatus } from '@v-gold/core';

const updateStaffSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'OPERATOR', 'MEMBER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.staff.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: membershipId } = await context.params;
    const rawBody = await req.json();
    const parseRes = updateStaffSchema.safeParse(rawBody);

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

    // 1. Update role if provided
    if (data.role) {
      const roleRes = await container.sellerOsService.updateStaffRole(
        auth.tenantId,
        membershipId,
        data.role as Role,
        auth.identity.user.id
      );
      if (roleRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: roleRes.error.code,
              message: roleRes.error.message,
            },
          },
          { status: roleRes.error.httpStatus }
        );
      }
    }

    // 2. Update status if provided
    if (data.status) {
      const statusRes = await container.sellerOsService.updateStaffStatus(
        auth.tenantId,
        membershipId,
        data.status as MembershipStatus,
        auth.identity.user.id
      );
      if (statusRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: statusRes.error.code,
              message: statusRes.error.message,
            },
          },
          { status: statusRes.error.httpStatus }
        );
      }
    }

    // 3. Fetch updated staff member
    const mem = await container.sellerOsService['membershipRepo'].findById(membershipId as any);
    if (!mem) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Membership "${membershipId}" not found.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: mem.id,
          tenantId: mem.tenantId,
          userId: mem.userId,
          role: mem.role,
          status: mem.status,
          updatedAt: mem.audit.updatedAt.toISOString(),
        },
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
