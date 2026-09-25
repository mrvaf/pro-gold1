import { NextResponse, type NextRequest } from 'next/server';
import { isPostgresConfigured } from '@v-gold/database';
import { rejectIdentityInput } from '@/lib/api/api-errors';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const identityViolation = rejectIdentityInput(req);
  if (identityViolation) {
    return identityViolation;
  }

  const dbConfigured = isPostgresConfigured();
  const memoryUsage = process.memoryUsage();

  const isReady = true;

  return NextResponse.json({
    status: isReady ? 'ready' : 'not_ready',
    probe: 'readiness',
    timestamp: new Date().toISOString(),
    details: {
      storage: dbConfigured ? 'postgres' : 'in-memory',
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
    },
  });
}
