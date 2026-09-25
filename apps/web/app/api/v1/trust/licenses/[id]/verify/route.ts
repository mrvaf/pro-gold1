import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

const verifyLicenseActionSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT']),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'tenant.update');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = verifyLicenseActionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid license action payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getTrustSafetyService();
    const updated =
      parseResult.data.action === 'VERIFY'
        ? await service.verifyGuildLicense(id, auth.tenantId)
        : await service.rejectGuildLicense(id, auth.tenantId, parseResult.data.reason ?? 'Verification failed');

    return NextResponse.json({
      success: true,
      data: updated.toJSON(),
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/licenses/[id]/verify:POST');
  }
}
