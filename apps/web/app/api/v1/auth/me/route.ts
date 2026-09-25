import { NextResponse, type NextRequest } from 'next/server';
import type { TenantMembership } from '@v-gold/core';
import { getDefaultAuthService } from '@/lib/auth/auth.service';
import {
  SESSION_COOKIE_NAME,
  createClearSessionCookieConfig,
} from '@/lib/auth/session-cookie';
import { rejectIdentityInput } from '@/lib/api/api-errors';

export async function GET(req: NextRequest) {
  const identityViolation = rejectIdentityInput(req);
  if (identityViolation) {
    return identityViolation;
  }

  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'No active authentication session found.',
        },
      },
      { status: 401 }
    );
  }

  const authService = getDefaultAuthService();
  const identity = await authService.authenticate(sessionId);

  if (!identity) {
    // Clear invalid session cookie
    const clearCookie = createClearSessionCookieConfig();
    const response = NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication session is invalid or has expired.',
        },
      },
      { status: 401 }
    );

    response.cookies.set(clearCookie.name, clearCookie.value, {
      httpOnly: clearCookie.httpOnly,
      secure: clearCookie.secure,
      sameSite: clearCookie.sameSite,
      path: clearCookie.path,
      maxAge: clearCookie.maxAge,
    });

    return response;
  }

  return NextResponse.json({
    user: identity.user,
    session: {
      id: identity.session.id,
      expiresAt: identity.session.expiresAt.toISOString(),
      createdAt: identity.session.createdAt.toISOString(),
    },
    memberships: identity.memberships.map((m: TenantMembership) => ({
      id: m.id,
      tenantId: m.tenantId,
      role: m.role,
      status: m.status,
    })),
  });
}
