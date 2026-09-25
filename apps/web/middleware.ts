import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSecurityHeaders } from '@v-gold/core';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const securityHeaders = buildSecurityHeaders({
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
