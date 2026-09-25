import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getPackagingService } from '@/lib/packaging/packaging-container';

const generatePreviewSchema = z.object({
  previewImageUrl: z.string().url().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await params;
    let previewImageUrl: string | undefined;

    const rawText = await req.text();
    if (rawText && rawText.trim().length > 0) {
      const rawBody = JSON.parse(rawText);
      const identityViolation = rejectIdentityInput(req, rawBody);
      if (identityViolation) {
        return identityViolation;
      }

      const parseResult = generatePreviewSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid packaging preview generation request',
              details: parseResult.error.format(),
            },
          },
          { status: 400 }
        );
      }
      previewImageUrl = parseResult.data.previewImageUrl;
    }

    const service = getPackagingService();
    const spec = await service.generateAiPreview(id, auth.tenantId, previewImageUrl);

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
