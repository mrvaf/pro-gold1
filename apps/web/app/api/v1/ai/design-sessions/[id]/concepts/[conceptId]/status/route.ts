import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDesignConceptContainer } from '@/lib/ai-designer/design-concept-container';

const updateStatusSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conceptId: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'ai.design');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = updateStatusSchema.safeParse(rawBody);
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

    const { id, conceptId } = await params;
    const { data } = parseResult;
    const container = getDesignConceptContainer();

    const result = await container.designConceptService.updateStatus({
      sessionId: id,
      conceptId,
      tenantId: auth.tenantId,
      action: data.action,
      actorId: auth.actorId,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(
      error,
      'api:v1/ai/design-sessions/[id]/concepts/[conceptId]/status'
    );
  }
}
