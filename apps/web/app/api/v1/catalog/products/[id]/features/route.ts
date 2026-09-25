import { NextRequest, NextResponse } from 'next/server';
import { createEntityId, type ProductId, type TenantId } from '@v-gold/core';
import { getVisualSearchContainer } from '@/lib/visual-search/visual-search-container';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantIdHeader = req.headers.get('x-tenant-id');
    const body = await req.json();

    const tenantId = (tenantIdHeader || body.tenantId) as string;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context is required (x-tenant-id header or tenantId body)' },
        { status: 400 }
      );
    }

    const { filename, mimeType, sizeBytes, dataBase64, productName, variantId, metadata } = body;

    if (!filename || !mimeType || sizeBytes === undefined) {
      return NextResponse.json(
        { error: 'Missing required image parameters: filename, mimeType, sizeBytes' },
        { status: 400 }
      );
    }

    const container = getVisualSearchContainer();
    const result = await container.visualSearchService.indexProductImage({
      tenantId: createEntityId<TenantId>(tenantId),
      productId: createEntityId<ProductId>(id),
      variantId: variantId ? createEntityId<any>(variantId) : undefined,
      productName: productName || 'Product',
      filename,
      mimeType,
      sizeBytes,
      dataBase64: dataBase64 || '',
      metadata,
    });

    if (result.isErr) {
      const err = result.error;
      const status = (err as any).httpStatus ?? 400;
      return NextResponse.json(
        { error: err.message, code: (err as any).code ?? 'INDEXING_ERROR' },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      embeddingId: result.value.embeddingId,
      dimensions: result.value.dimensions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
