import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId } from '@v-gold/core';
import { getSellerOsContainer } from '@/lib/seller-os/seller-os-container';
import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

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
    const auth = await authenticateRequest(req, 'seller.os.read');
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
        return toErrorResponse(wsRes.error);
      }
      return NextResponse.json({ success: true, data: wsRes.value.toDto() });
    }

    if (sellerProfileId) {
      const wsRes = await container.sellerOsService.getWorkspaceBySeller(sellerProfileId, tenantId);
      if (wsRes.isErr) {
        return toErrorResponse(wsRes.error);
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
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = createWorkspaceSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
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
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'seller.os.manage');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
    const parseRes = updateWorkspaceSchema.safeParse(rawBody);

    if (!parseRes.success) {
      return validationErrorResponse('Invalid request payload schema.', parseRes.error.format());
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
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
