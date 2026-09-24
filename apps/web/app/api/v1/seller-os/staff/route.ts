import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';
import type { Role } from '@v-gold/core';

const addStaffSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.enum(['OWNER', 'ADMIN', 'OPERATOR', 'MEMBER']),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.staff.read');
    if (!auth.ok) {
      return auth.response;
    }

    const container = getSellerOsContainer();
    const result = await container.sellerOsService.listStaff(auth.tenantId);

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
        data: result.value,
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

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.staff.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const parseRes = addStaffSchema.safeParse(rawBody);

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

    const result = await container.sellerOsService.addStaffMember(
      auth.tenantId,
      data.userId,
      data.role as Role,
      auth.identity.user.id
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
