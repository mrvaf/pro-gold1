import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDesignSessionContainer } from '@/lib/ai-designer/design-session-container';

const addMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty.').max(8000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const parseResult = addMessageSchema.safeParse(rawBody);
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

    const { id } = await params;
    const { data } = parseResult;
    const container = getDesignSessionContainer();

    const result = await container.designSessionService.addMessage({
      sessionId: id,
      tenantId: auth.tenantId,
      content: data.content,
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
    return toErrorResponse(error, 'api:v1/ai/design-sessions/[id]/messages');
  }
}
