import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { TenantMembership } from '@v-gold/core';
import { getDefaultAuthService } from '@/lib/auth/auth.service';
import { createSessionCookieConfig } from '@/lib/auth/session-cookie';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identityViolation = rejectIdentityInput(req, body);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return validationErrorResponse('Invalid login parameters.');
    }

    const authService = getDefaultAuthService();
    const result = await authService.login({
      ...parseResult.data,
      userAgent: req.headers.get('user-agent') ?? undefined,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    const { user, session, memberships } = result.value;
    const cookieConfig = createSessionCookieConfig(session.id);

    const response = NextResponse.json(
      {
        user,
        memberships: memberships.map((m: TenantMembership) => ({
          id: m.id,
          tenantId: m.tenantId,
          role: m.role,
          status: m.status,
        })),
      },
      { status: 200 }
    );

    response.cookies.set(cookieConfig.name, cookieConfig.value, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.path,
      maxAge: cookieConfig.maxAge,
    });

    return response;
  } catch (error) {
    return toErrorResponse(error, 'api:auth/login');
  }
}
