import { type NextRequest, NextResponse } from 'next/server';
import { type Permission, type TenantMembership } from '@v-gold/core';
import { getDefaultAuthService, type AuthenticatedIdentity } from '@/lib/auth/auth.service';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

export interface AuthContextSuccess {
  ok: true;
  identity: AuthenticatedIdentity;
  membership: TenantMembership;
  tenantId: string;
}

export interface AuthContextFailure {
  ok: false;
  response: NextResponse;
}

export type AuthContextResult = AuthContextSuccess | AuthContextFailure;

/**
 * Validates session authentication, tenant membership, and granular role permissions.
 *
 * Security Policy:
 * - Strictly enforces HttpOnly, SameSite session cookies as established in Stage 3 ADR-0016.
 * - Non-standard headers (e.g. x-session-id or loose Bearer tokens) are strictly prohibited
 *   in production authentication paths to prevent token storage in client-accessible storage
 *   (mitigating XSS extraction and CSRF subversion).
 * - Enforces zero cross-tenant leakage (IDOR prevention).
 */
export async function authenticateSellerOsRequest(
  req: NextRequest,
  requiredPermission?: Permission,
  explicitTenantId?: string
): Promise<AuthContextResult> {
  // 1. Extract session ID strictly from authoritative HttpOnly session cookie
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 32) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. No active session cookie found.',
          },
        },
        { status: 401 }
      ),
    };
  }

  // 2. Authenticate session with auth service
  const authService = getDefaultAuthService();
  const identity = await authService.authenticate(sessionId);
  if (!identity) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session token is invalid or expired.',
          },
        },
        { status: 401 }
      ),
    };
  }

  // 3. Determine target tenantId
  const url = new URL(req.url);
  const targetTenantId =
    explicitTenantId ||
    req.headers.get('x-tenant-id') ||
    url.searchParams.get('tenantId') ||
    identity.memberships[0]?.tenantId;

  if (!targetTenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Tenant context is missing. Provide x-tenant-id or tenantId parameter.',
          },
        },
        { status: 400 }
      ),
    };
  }

  // 4. Verify tenant membership
  const membership = identity.memberships.find(
    (m) => m.tenantId === targetTenantId && m.isActive()
  );

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. User is not an active member of tenant "${targetTenantId}".`,
          },
        },
        { status: 403 }
      ),
    };
  }

  // 5. Verify granular permission if specified
  if (requiredPermission && !membership.can(requiredPermission)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Role "${membership.role}" lacks required permission "${requiredPermission}".`,
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    identity,
    membership,
    tenantId: targetTenantId,
  };
}
