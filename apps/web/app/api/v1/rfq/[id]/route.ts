import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId, type RfqId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getRfqContainer } from '@/lib/rfq/rfq-container';

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
    const container = getRfqContainer();

    const result = await container.rfqService.getRfq(
      createEntityId<RfqId>(id),
      createEntityId<TenantId>(auth.tenantId)
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        rfq: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/rfq/[id]');
  }
}
