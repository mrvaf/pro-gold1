import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { getDesignConceptContainer } from '@/lib/ai-designer/design-concept-container';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conceptId: string }> }
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

    const { id, conceptId } = await params;
    const container = getDesignConceptContainer();
    const result = await container.designConceptService.getConcept(
      conceptId,
      id,
      auth.tenantId
    );

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
    return toErrorResponse(error, 'api:v1/ai/design-sessions/[id]/concepts/[conceptId]');
  }
}
