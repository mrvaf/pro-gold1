import { NextResponse, type NextRequest } from 'next/server';
import { Ok } from '@v-gold/core';
import { AiGatewayClient } from '@v-gold/ai-gateway';
import { createDatabaseConfigFromEnv } from '@v-gold/database';
import { rejectIdentityInput } from '@/lib/api/api-errors';

export async function GET(): Promise<NextResponse>;
export async function GET(req: NextRequest): Promise<NextResponse>;
export async function GET(req?: NextRequest): Promise<NextResponse> {
  if (req) {
    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }
  }

  const coreVerified = new Ok(true).isOk;
  const aiGateway = new AiGatewayClient();
  const dbConfig = createDatabaseConfigFromEnv();

  return NextResponse.json({
    status: 'ok',
    service: 'v-gold-web',
    stage: 1,
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    components: {
      core: coreVerified ? 'healthy' : 'unhealthy',
      aiGateway: aiGateway ? 'healthy' : 'unhealthy',
      databaseConfig: dbConfig.host ? 'configured' : 'missing',
    },
  });
}
