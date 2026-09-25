import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDesignSessionContainer } from '@/lib/ai-designer/design-session-container';

const createSessionSchema = z.object({
  title: z.string().optional(),
  initialMessage: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'ai.design');
    if (!auth.ok) {
      return auth.response;
    }

    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const container = getDesignSessionContainer();
    const result = await container.designSessionService.listSessions(auth.tenantId, limit);

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.map((s) => s.toDto()),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/ai/design-sessions');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'ai.design');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json().catch(() => ({}));
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = createSessionSchema.safeParse(rawBody);
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
    const container = getDesignSessionContainer();

    const result = await container.designSessionService.createSession({
      tenantId: auth.tenantId,
      userId: auth.actorId,
      title: data.title,
      initialMessage: data.initialMessage,
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
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/ai/design-sessions');
  }
}
