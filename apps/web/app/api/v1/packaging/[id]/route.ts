import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getPackagingService } from '@/lib/packaging/packaging-container';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await params;
    const service = getPackagingService();
    const spec = await service.getSpecificationById(id, auth.tenantId);

    return NextResponse.json(
      {
        success: true,
        packaging: spec.toJSON(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
