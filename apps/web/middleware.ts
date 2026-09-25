import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface SecurityHeadersOptions {
  readonly isProduction?: boolean;
  readonly contentSecurityPolicy?: string;
}

function getSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const defaultCsp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': options.contentSecurityPolicy ?? defaultCsp,
  };

  if (options.isProduction !== false) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const securityHeaders = getSecurityHeaders({
    isProduction: process.env.NODE_ENV === 'production',
  });

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
