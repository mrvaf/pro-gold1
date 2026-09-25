import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DomainError } from '@v-gold/core';

/**
 * Shared API error mapper (ADR-0042).
 *
 * Security policy:
 * - Known `DomainError` instances map to their stable public contract
 *   (`code`, crafted `message`, `httpStatus`) — these messages are authored API
 *   semantics, not raw runtime errors.
 * - Any *unknown* error is mapped to a generic `INTERNAL_ERROR` and its raw
 *   `error.message` is NEVER returned to the client. The failure is logged
 *   server-side without secrets/PII (never logs request bodies, headers,
 *   cookies, credentials, or user identity).
 */

export const GENERIC_INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred.';

/** Query parameters and body fields that clients must never send. */
export const IDENTITY_INPUT_FIELDS = ['tenantId', 'actorId'] as const;
/** Headers that clients must never send (tenant/actor come from the session only). */
export const IDENTITY_INPUT_HEADERS = ['x-tenant-id', 'x-actor-id'] as const;

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Server-side logging for unexpected errors.
 * Deliberately excludes secrets/PII: no request payloads, headers, cookies,
 * tokens, emails, or user identifiers are ever written to the log.
 */
export function logUnexpectedError(scope: string, error: unknown): void {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  console.error(`[api-error] ${scope}: unexpected error (${name})`, stack);
}

/**
 * Maps any thrown/unknown error onto the uniform API error contract.
 * Domain errors keep their public contract; unknown errors are sanitized to a
 * generic INTERNAL_ERROR (500) with a secret/PII-free server-side log.
 */
export function toErrorResponse(
  error: unknown,
  scope = 'api',
  codeOverride?: string
): NextResponse {
  if (isDomainError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: codeOverride ?? error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.httpStatus }
    );
  }

  logUnexpectedError(scope, error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: GENERIC_INTERNAL_ERROR_MESSAGE,
      },
    },
    { status: 500 }
  );
}

export function validationErrorResponse(
  message = 'Invalid request payload schema.',
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status: 400 }
  );
}

/**
 * Detects client-supplied identity fields (`tenantId`/`actorId` in the query
 * string or JSON body, `x-tenant-id`/`x-actor-id` headers). Returns the
 * offending field name, or null when none are present.
 */
export function findForbiddenIdentityInput(
  req: NextRequest,
  body?: unknown
): string | null {
  const { searchParams } = new URL(req.url);
  for (const field of IDENTITY_INPUT_FIELDS) {
    if (searchParams.has(field)) return field;
  }
  for (const header of IDENTITY_INPUT_HEADERS) {
    if (req.headers.get(header) !== null) return header;
  }
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    for (const field of IDENTITY_INPUT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) return field;
    }
  }
  return null;
}

/**
 * 400 VALIDATION_ERROR for client-supplied tenant/actor identity fields.
 * Tenant and actor are derived exclusively from the session (ADR-0041).
 */
export function identityFieldViolationResponse(field: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          `Client-supplied identity field "${field}" is not accepted. "tenantId" and "actorId" are derived exclusively from the session.`,
      },
    },
    { status: 400 }
  );
}

/**
 * Shared pre-flight guard for handlers that parse input themselves (public and
 * session endpoints): rejects any client-supplied identity field with 400.
 */
export function rejectIdentityInput(req: NextRequest, body?: unknown): NextResponse | null {
  const violation = findForbiddenIdentityInput(req, body);
  return violation ? identityFieldViolationResponse(violation) : null;
}
