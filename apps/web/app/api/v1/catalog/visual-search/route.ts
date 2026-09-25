import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type TenantId } from '@v-gold/core';
import { getVisualSearchContainer } from '@/lib/visual-search/visual-search-container';

export async function POST(req: NextRequest) {
  try {
    const tenantIdHeader = req.headers.get('x-tenant-id');
    const body = await req.json();

    const tenantId = (tenantIdHeader || body.tenantId) as string;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context is required (x-tenant-id header or tenantId body)' },
        { status: 400 }
      );
    }

    const { filename, mimeType, sizeBytes, dataBase64, limit, minSimilarity } = body;

    if (!filename || !mimeType || sizeBytes === undefined) {
      return NextResponse.json(
        { error: 'Missing required image parameters: filename, mimeType, sizeBytes' },
        { status: 400 }
      );
    }

    const container = getVisualSearchContainer();
    const result = await container.visualSearchService.searchByImage({
      tenantId: createEntityId<TenantId>(tenantId),
      filename,
      mimeType,
      sizeBytes,
      dataBase64: dataBase64 || '',
      limit: limit ? Number(limit) : 10,
      minSimilarity: minSimilarity ? Number(minSimilarity) : 0.5,
    });

    if (result.isErr) {
      const err = result.error;
      const status = (err as any).httpStatus ?? 400;
      return NextResponse.json(
        { error: err.message, code: (err as any).code ?? 'VISUAL_SEARCH_ERROR' },
        { status }
      );
    }

    return NextResponse.json({
      matches: result.value.map((item) => item.toDto()),
      count: result.value.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
