import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId } from '@v-gold/core';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateSellerOsRequest } from '@/lib/seller-os/seller-os-auth';

const createWorkspaceSchema = z.object({
  sellerProfileId: z.string().min(1, 'sellerProfileId is required'),
  name: z.string().min(2, 'Name must have at least 2 characters').max(255),
  storeId: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const updateWorkspaceSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  name: z.string().min(2).max(255).optional(),
  storeId: z.string().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.os.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { tenantId } = auth;
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const sellerProfileId = url.searchParams.get('sellerProfileId');

    const container = getSellerOsContainer();

    if (workspaceId) {
      const wsRes = await container.sellerOsService.getWorkspaceById(workspaceId, tenantId);
      if (wsRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: wsRes.error.code,
              message: wsRes.error.message,
            },
          },
          { status: wsRes.error.httpStatus }
        );
      }
      return NextResponse.json({ success: true, data: wsRes.value.toDto() });
    }

    if (sellerProfileId) {
      const wsRes = await container.sellerOsService.getWorkspaceBySeller(sellerProfileId, tenantId);
      if (wsRes.isErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: wsRes.error.code,
              message: wsRes.error.message,
            },
          },
          { status: wsRes.error.httpStatus }
        );
      }
      return NextResponse.json({ success: true, data: wsRes.value.toDto() });
    }

    // List all workspaces for tenant
    const workspaces = await container.workspaceRepo.listByTenant(
      createEntityId<TenantId>(tenantId)
    );
    return NextResponse.json({
      success: true,
      data: workspaces.map((w) => w.toDto()),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const parseRes = createWorkspaceSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload schema.',
            details: parseRes.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.createWorkspace({
      tenantId: auth.tenantId,
      sellerProfileId: data.sellerProfileId,
      name: data.name,
      storeId: data.storeId,
      settings: data.settings,
      actorId: auth.identity.user.id,
    });

    if (result.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: result.error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateSellerOsRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const parseRes = updateWorkspaceSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload schema.',
            details: parseRes.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseRes;
    const container = getSellerOsContainer();

    const result = await container.sellerOsService.updateWorkspace({
      workspaceId: data.workspaceId,
      tenantId: auth.tenantId,
      name: data.name,
      storeId: data.storeId === null ? '' : data.storeId,
      settings: data.settings,
      actorId: auth.identity.user.id,
    });

    if (result.isErr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: result.error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
