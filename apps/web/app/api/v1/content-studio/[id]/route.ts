import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getContentStudioService } from '@/lib/content-studio/content-studio-container';

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
    const service = getContentStudioService();
    const asset = await service.getAssetById(id, auth.tenantId);

    return NextResponse.json(
      {
        success: true,
        contentAsset: asset.toJSON(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
