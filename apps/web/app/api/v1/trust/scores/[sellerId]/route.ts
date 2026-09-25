import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getTrustSafetyService } from '@/lib/trust-safety/trust-safety-container';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sellerId: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { sellerId } = await context.params;
    const service = getTrustSafetyService();
    const breakdown = await service.getSellerTrustBreakdown(sellerId, auth.tenantId);

    return NextResponse.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/trust/scores/[sellerId]:GET');
  }
}
