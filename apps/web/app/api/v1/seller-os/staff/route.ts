import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
import type { Role } from '@v-gold/core';

const addStaffSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(['OWNER', 'ADMIN', 'OPERATOR', 'MEMBER']),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.staff.read');
    if (!auth.ok) {
      return auth.response;
    }

    const container = getSellerOsContainer();
    const result = await container.sellerOsService.listStaff(auth.tenantId);

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value,
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.staff.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = addStaffSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.addStaffMember(
      auth.tenantId,
      data.userId,
      data.role as Role,
      auth.identity.user.id
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    const mem = result.value;
    return NextResponse.json(
      {
        success: true,
        data: {
          id: mem.id,
          tenantId: mem.tenantId,
          userId: mem.userId,
          role: mem.role,
          status: mem.status,
          createdAt: mem.audit.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
