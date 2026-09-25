import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId, type Studio3DAssetId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getStudio3DContainer } from '@/lib/studio-3d/studio-3d-container';

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
    const container = getStudio3DContainer();

    const result = await container.studio3dService.getPreview(
      createEntityId<Studio3DAssetId>(id),
      createEntityId<TenantId>(auth.tenantId)
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        preview: result.value,
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/studio-3d/assets/[id]');
  }
}
