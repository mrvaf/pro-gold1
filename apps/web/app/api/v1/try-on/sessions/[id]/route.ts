import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId, type TryOnSessionId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getTryOnContainer } from '@/lib/try-on/try-on-container';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await params;
    const container = getTryOnContainer();

    const result = await container.tryOnService.getActiveSession(
      createEntityId<TryOnSessionId>(id),
      createEntityId<TenantId>(auth.tenantId)
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        session: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/try-on/sessions/[id]');
  }
}
