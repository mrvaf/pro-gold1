import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId, type UserId, type RfqId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getRfqContainer } from '@/lib/rfq/rfq-container';

const postMessageSchema = z.object({
  senderRole: z.enum(['CUSTOMER', 'SELLER', 'GOLDSMITH']),
  content: z.string().min(1, 'message content is required'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: rfqId } = await params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = postMessageSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body schema.',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseResult;
    const container = getRfqContainer();

    const result = await container.rfqService.postMessage({
      tenantId: createEntityId<TenantId>(auth.tenantId),
      rfqId: createEntityId<RfqId>(rfqId),
      senderId: createEntityId<UserId>(auth.actorId),
      senderRole: data.senderRole,
      content: data.content,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        message: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/rfq/[id]/messages');
  }
}
