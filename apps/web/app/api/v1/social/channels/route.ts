import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getSocialCommerceService } from '@/lib/social-commerce/social-commerce-container';

const connectChannelSchema = z.object({
  platform: z.enum(['INSTAGRAM', 'TELEGRAM', 'WHATSAPP']),
  channelName: z.string().min(1, 'Channel name is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  accountId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const service = getSocialCommerceService();
    const channels = await service.listChannels(auth.tenantId);

    // Return channels without plain tokens or sensitive decryptable payloads directly
    const safeChannels = channels.map((c) => {
      const json = c.toJSON();
      return {
        id: json.id,
        tenantId: json.tenantId,
        platform: json.platform,
        channelName: json.channelName,
        accountId: json.accountId,
        isActive: json.isActive,
        createdAt: json.createdAt.toISOString(),
        updatedAt: json.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: safeChannels,
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/social/channels:GET');
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

    const parseResult = connectChannelSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid channel connection payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const service = getSocialCommerceService();
    const channel = await service.connectChannel({
      tenantId: auth.tenantId,
      platform: parseResult.data.platform,
      channelName: parseResult.data.channelName,
      accessToken: parseResult.data.accessToken,
      accountId: parseResult.data.accountId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: channel.id,
          platform: channel.platform,
          channelName: channel.channelName,
          accountId: channel.accountId,
          isActive: channel.isActive,
          createdAt: channel.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/social/channels:POST');
  }
}
