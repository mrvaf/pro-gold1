import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getSocialCommerceService } from '@/lib/social-commerce/social-commerce-container';

const schedulePostSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  contentAssetId: z.string().optional(),
  caption: z.string().min(1, 'Caption is required'),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const service = getSocialCommerceService();
    const posts = await service.listPosts(auth.tenantId, limit);

    return NextResponse.json({
      success: true,
      data: posts.map((p) => p.toJSON()),
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/social/posts:GET');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Request body must be a valid JSON object',
        },
        { status: 400 }
      );
    }

    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = schedulePostSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule post payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getSocialCommerceService();
    const post = await service.schedulePost({
      tenantId: auth.tenantId,
      channelId: parseResult.data.channelId,
      contentAssetId: parseResult.data.contentAssetId,
      caption: parseResult.data.caption,
      mediaUrls: parseResult.data.mediaUrls,
      scheduledAt: parseResult.data.scheduledAt,
    });

    return NextResponse.json(
      {
        success: true,
        data: post.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/social/posts:POST');
  }
}
