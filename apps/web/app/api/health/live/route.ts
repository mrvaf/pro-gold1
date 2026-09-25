import { NextResponse, type NextRequest } from 'next/server';
import { rejectIdentityInput } from '@/lib/api/api-errors';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const identityViolation = rejectIdentityInput(req);
  if (identityViolation) {
    return identityViolation;
  }

  return NextResponse.json({
    status: 'healthy',
    probe: 'liveness',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
