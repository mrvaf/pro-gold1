import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { getDesignSessionContainer } from '@/lib/ai-designer/design-session-container';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'ai.design');
    if (!auth.ok) {
      return auth.response;
    }

    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }

    const { id } = await params;
    const container = getDesignSessionContainer();

    const result = await container.designSessionService.completeSession({
      sessionId: id,
      tenantId: auth.tenantId,
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
    return toErrorResponse(error, 'api:v1/ai/design-sessions/[id]/complete');
  }
}
