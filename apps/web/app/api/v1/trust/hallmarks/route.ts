import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

const hallmarkAuditSchema = z.object({
  inventoryItemId: z.string().optional(),
  productVariantId: z.string().optional(),
  hallmarkCode: z.string().min(1, 'Hallmark code is required'),
  labAuthority: z.string().min(1, 'Lab authority is required'),
  verifiedFineness: z.number().min(375).max(999.9),
  auditNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

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

    const parseResult = hallmarkAuditSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid hallmark audit payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getTrustSafetyService();
    const auditRecord = await service.recordHallmarkAudit({
      tenantId: auth.tenantId,
      inventoryItemId: parseResult.data.inventoryItemId,
      productVariantId: parseResult.data.productVariantId,
      hallmarkCode: parseResult.data.hallmarkCode,
      labAuthority: parseResult.data.labAuthority,
      verifiedFineness: parseResult.data.verifiedFineness,
      auditNotes: parseResult.data.auditNotes,
    });

    return NextResponse.json(
      {
        success: true,
        data: auditRecord.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/hallmarks:POST');
  }
}
