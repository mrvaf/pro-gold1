import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getSocialCommerceService } from '@/lib/social-commerce/social-commerce-container';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const service = getSocialCommerceService();
    const publishedPost = await service.publishDuePost(id, auth.tenantId);

    return NextResponse.json({
      success: true,
      data: publishedPost.toJSON(),
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/social/posts/[id]/publish:POST');
  }
}
