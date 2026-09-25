import { type NextRequest, NextResponse } from 'next/server';
import { type Permission, type TenantMembership } from '@v-gold/core';
import { getDefaultAuthService, type AuthenticatedIdentity } from '@/lib/auth/auth.service';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import {
  findForbiddenIdentityInput,
  identityFieldViolationResponse,
} from '@/lib/api/api-errors';

export interface AuthContextSuccess {
  ok: true;
  identity: AuthenticatedIdentity;
  membership: TenantMembership;
  tenantId: string;
  actorId: string;
}

export interface AuthContextFailure {
  ok: false;
  response: NextResponse;
}

export type AuthContextResult = AuthContextSuccess | AuthContextFailure;

/**
 * Shared request authentication & authorization helper (ADR-0041).
 *
 * Security policy (Stage 8.1):
 * - Tenant and actor are derived EXCLUSIVELY from the `vgold_session` HttpOnly
 *   cookie chain: valid session -> active user -> active membership -> explicit
 *   operation permission. Clients can never supply `tenantId`/`actorId`
 *   (query/body) or `x-tenant-id`/`x-actor-id` (headers); doing so is rejected
 *   with 400 VALIDATION_ERROR after authentication succeeds.
 * - Authentication and authorization are evaluated BEFORE any client input is
 *   processed (401/403 take precedence over 400).
 * - Strictly enforces HttpOnly, SameSite session cookies as established in
 *   Stage 3 ADR-0016/ADR-0014. Non-standard headers (e.g. x-session-id or loose
 *   Bearer tokens) are strictly prohibited in production authentication paths.
 * - Enforces zero cross-tenant leakage (IDOR prevention).
 */
export async function authenticateRequest(
  req: NextRequest,
  requiredPermission?: Permission
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

  // 2. Authenticate session with auth service (valid session + active user)
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

  // 3. Resolve the active membership (tenant context) from the session only
  const activeMemberships = identity.memberships
    .filter((m) => m.isActive())
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const membership = activeMemberships[0];

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. The user has no active tenant membership.',
          },
        },
        { status: 403 }
      ),
    };
  }

  // 4. Verify granular permission if specified
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

  // 5. Reject any client-supplied identity input (query params / headers).
  //    Body fields are checked by the route handlers after JSON parsing.
  const violation = findForbiddenIdentityInput(req);
  if (violation) {
    return { ok: false, response: identityFieldViolationResponse(violation) };
  }

  return {
    ok: true,
    identity,
    membership,
    tenantId: membership.tenantId,
    actorId: identity.user.id,
  };
}
