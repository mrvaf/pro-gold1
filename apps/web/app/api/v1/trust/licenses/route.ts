import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

const submitGuildLicenseSchema = z.object({
  sellerProfileId: z.string().min(1, 'Seller profile ID is required'),
  guildRegistrationNumber: z.string().min(1, 'Guild registration number is required'),
  guildName: z.string().min(1, 'Guild name is required'),
  issuanceDate: z.string().datetime().transform((str) => new Date(str)),
  expiryDate: z.string().datetime().transform((str) => new Date(str)),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'marketplace.seller.manage');
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

    const parseResult = submitGuildLicenseSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid guild license payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getTrustSafetyService();
    const license = await service.submitGuildLicense({
      tenantId: auth.tenantId,
      sellerProfileId: parseResult.data.sellerProfileId,
      guildRegistrationNumber: parseResult.data.guildRegistrationNumber,
      guildName: parseResult.data.guildName,
      issuanceDate: parseResult.data.issuanceDate,
      expiryDate: parseResult.data.expiryDate,
    });

    return NextResponse.json(
      {
        success: true,
        data: license.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/licenses:POST');
  }
}
