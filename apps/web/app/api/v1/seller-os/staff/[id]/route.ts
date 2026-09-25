import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
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
    const auth = await authenticateRequest(req, 'seller.staff.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: membershipId } = await context.params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = updateStaffSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
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
        return toErrorResponse(roleRes.error);
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
        return toErrorResponse(statusRes.error);
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
  } catch (error) {
    return toErrorResponse(error);
  }
}
