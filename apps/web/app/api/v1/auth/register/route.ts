import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { TenantMembership } from '@v-gold/core';
import { getDefaultAuthService } from '@/lib/auth/auth.service';
import { createSessionCookieConfig } from '@/lib/auth/session-cookie';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(100).optional(),
  tenantSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration parameters.',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const authService = getDefaultAuthService();
    const result = await authService.register({
      ...parseResult.data,
      userAgent: req.headers.get('user-agent') ?? undefined,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    if (result.isErr) {
      const error = result.error;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.httpStatus }
      );
    }

    const { user, session, tenant, memberships } = result.value;
    const cookieConfig = createSessionCookieConfig(session.id);

    const response = NextResponse.json(
      {
        user,
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            }
          : undefined,
        memberships: memberships.map((m: TenantMembership) => ({
          id: m.id,
          tenantId: m.tenantId,
          role: m.role,
          status: m.status,
        })),
      },
      { status: 201 }
    );

    response.cookies.set(cookieConfig.name, cookieConfig.value, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
      maxAge: cookieConfig.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during registration.',
        },
      },
      { status: 500 }
    );
  }
}
